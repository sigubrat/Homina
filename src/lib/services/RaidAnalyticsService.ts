import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController, logger } from "@/lib";
import { createUnknownUserTracker } from "@/lib/utils/userUtils";
import { getPrimeDisplayName } from "@/lib/utils/utils";
import { expandRarity } from "@/lib/utils/rarityUtils";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { GuildRaidResult, Raid } from "@/models/types";
import { MINIMUM_SEASON_THRESHOLD } from "../configs/constants";
import { GuildService } from "./GuildService";

export class RaidAnalyticsService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    async getGuildRaidResultBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
        includePrimes: boolean = true,
    ): Promise<GuildRaidResult[] | null> {
        const apiKey = await this.db.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            const rarities = expandRarity(rarity);
            entries = entries.filter((entry) =>
                rarities.includes(entry.rarity),
            );
        }

        const damagePeruser: GuildRaidResult[] = [];

        for (const entry of entries) {
            if (!entry.userId) {
                continue;
            }

            if (
                !includePrimes &&
                entry.encounterType === EncounterType.SIDE_BOSS
            ) {
                continue;
            }

            const username = entry.userId;

            const existingEntry = damagePeruser.find(
                (e) => e.username === username,
            );

            const isPrime = entry.encounterType === EncounterType.SIDE_BOSS;

            if (existingEntry) {
                if (entry.damageType === DamageType.BOMB) {
                    existingEntry.bombCount++;
                    continue;
                }
                existingEntry.totalDamage += entry.damageDealt;
                existingEntry.totalTokens += 1;
                existingEntry.maxDmg = Math.max(
                    existingEntry.maxDmg ?? 0,
                    entry.damageDealt,
                );
                existingEntry.minDmg = Math.min(
                    existingEntry.minDmg ?? entry.damageDealt,
                    entry.damageDealt,
                );
                if (isPrime) {
                    existingEntry.primeDamage =
                        (existingEntry.primeDamage ?? 0) + entry.damageDealt;
                }
            } else {
                if (entry.damageType === DamageType.BOMB) {
                    damagePeruser.push({
                        username: username,
                        totalDamage: 0,
                        totalTokens: 0,
                        boss: entry.type,
                        set: entry.set + 1,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: undefined,
                        maxDmg: undefined,
                        bombCount: 1,
                        primeDamage: 0,
                    });
                } else {
                    damagePeruser.push({
                        username: username,
                        totalDamage: entry.damageDealt,
                        totalTokens: 1,
                        boss: entry.type,
                        set: entry.set + 1,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: entry.damageDealt,
                        maxDmg: entry.damageDealt,
                        bombCount: 0,
                        primeDamage: isPrime ? entry.damageDealt : 0,
                    });
                }
            }
        }
        return damagePeruser;
    }

    async getGuildRaidResultByRaritySeasonPerBoss(
        discordId: string,
        season: number,
        rarity?: Rarity,
        filterBombs: boolean = false,
        encounterTypeFilter?: EncounterType,
    ) {
        const apiKey = await this.db.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const guildService = new GuildService(this.client);
        const players = await guildService.fetchGuildMembers(discordId);
        if (!players) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            const rarities = expandRarity(rarity);
            entries = entries.filter((entry) =>
                rarities.includes(entry.rarity),
            );
        }

        if (filterBombs) {
            entries = entries.filter(
                (entry) => entry.damageType !== DamageType.BOMB,
            );
        }

        if (encounterTypeFilter) {
            entries = entries.filter(
                (entry) => entry.encounterType === encounterTypeFilter,
            );
        }

        const unknownTracker = createUnknownUserTracker();

        for (const entry of entries) {
            const player = players.find((p) => p.userId === entry.userId);
            if (player) {
                entry.userId = player.displayName;
            } else {
                entry.userId = unknownTracker.getLabel(entry.userId);
            }
        }

        const groupedResults: Record<string, GuildRaidResult[]> = {};

        for (const entry of entries) {
            if (!entry.userId) {
                continue;
            }

            const boss =
                encounterTypeFilter === EncounterType.SIDE_BOSS
                    ? entry.unitId
                    : `${entry.rarity}_${entry.type}`;

            if (!groupedResults[boss]) {
                groupedResults[boss] = [];
            }

            const username = entry.userId;

            const existingUserEntry = groupedResults[boss].find(
                (e) => e.username === username,
            );

            if (existingUserEntry) {
                if (entry.damageType === DamageType.BOMB) {
                    existingUserEntry.bombCount++;
                    continue;
                }
                existingUserEntry.totalDamage += entry.damageDealt;
                existingUserEntry.totalTokens += 1;

                if (entry.encounterType === EncounterType.SIDE_BOSS) {
                    existingUserEntry.primeDamage =
                        (existingUserEntry.primeDamage ?? 0) +
                        entry.damageDealt;
                }

                existingUserEntry.maxDmg = Math.max(
                    existingUserEntry.maxDmg ?? 0,
                    entry.damageDealt,
                );

                existingUserEntry.minDmg = Math.min(
                    existingUserEntry.minDmg ?? entry.damageDealt,
                    entry.damageDealt,
                );
            } else {
                const bossDisplayName =
                    entry.encounterType === EncounterType.SIDE_BOSS
                        ? getPrimeDisplayName(entry.unitId)
                        : entry.type;

                if (entry.damageType === DamageType.BOMB) {
                    groupedResults[boss].push({
                        bombCount: 1,
                        username: username,
                        totalDamage: 0,
                        totalTokens: 0,
                        primeDamage: 0,
                        boss: bossDisplayName,
                        set: entry.set + 1,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: undefined,
                        maxDmg: undefined,
                    });
                } else {
                    groupedResults[boss].push({
                        bombCount: 0,
                        username: username,
                        totalDamage: entry.damageDealt,
                        primeDamage:
                            entry.encounterType === EncounterType.SIDE_BOSS
                                ? entry.damageDealt
                                : 0,
                        totalTokens: 1,
                        boss: bossDisplayName,
                        set: entry.set + 1,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: entry.damageDealt,
                        maxDmg: entry.damageDealt,
                    });
                }
            }
        }

        return groupedResults;
    }

    async getGuildRaidBombsBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ): Promise<Record<string, number> | null> {
        const apiKey = await this.db.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            const rarities = expandRarity(rarity);
            entries = entries.filter((entry) =>
                rarities.includes(entry.rarity),
            );
        }

        const bombs: Raid[] = entries.filter(
            (entry) => entry.damageType === DamageType.BOMB,
        );

        const bombsPerUser: Record<string, number> = {};
        for (const bomb of bombs) {
            const username = bomb.userId;
            bombsPerUser[username] = (bombsPerUser[username] ?? 0) + 1;
        }

        return bombsPerUser;
    }

    async getGuildRaidBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ) {
        const apiKey = await this.db.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        if (rarity) {
            const rarities = expandRarity(rarity);
            resp.entries = resp.entries.filter((entry) =>
                rarities.includes(entry.rarity),
            );
        }

        const entries = resp.entries;
        if (!entries) {
            return null;
        }

        return entries;
    }

    async getMemberStatsInLastSeasons(
        discordId: string,
        nSeasons: number,
        rarity?: Rarity,
    ) {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                logger.error("No API key found for user:", discordId);
                return null;
            }

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!currentSeason || !currentSeason.season) {
                logger.error("No current season found for user:", discordId);
                return null;
            }

            const currentSeasonNumber = currentSeason.season;
            const seasons: number[] = [];
            for (let i = nSeasons - 1; i >= 0; i--) {
                if (currentSeasonNumber - i < MINIMUM_SEASON_THRESHOLD) {
                    break;
                }
                seasons.push(currentSeasonNumber - i);
            }

            const seasonPromises = seasons.map(
                async (season) =>
                    await this.getGuildRaidResultByRaritySeasonPerBoss(
                        discordId,
                        season,
                        rarity,
                    ),
            );

            const responses = await Promise.all(seasonPromises);
            const resultBySeason: Record<
                number,
                Record<string, GuildRaidResult[]> | null
            > = {};

            responses.forEach((res, idx) => {
                const seasonNr = seasons[idx];
                if (!seasonNr || !res) {
                    return [] as GuildRaidResult[];
                }
                resultBySeason[seasonNr] = res;
            });

            return resultBySeason;
        } catch (error) {
            logger.error(
                error,
                "Error fetching member stats in last seasons: ",
            );
            return null;
        }
    }

    async getWeightedRelativePerformance(
        discordId: string,
        season: number,
        rarity?: Rarity,
        seasonCount: number = 1,
    ): Promise<Record<string, number> | null> {
        const MIN_HITS_PER_BOSS = 2;

        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const guildService = new GuildService(this.client);
            const players = await guildService.fetchGuildMembers(discordId);
            if (!players) {
                return null;
            }

            const seasons = Array.from(
                { length: seasonCount },
                (_, i) => season - seasonCount + 1 + i,
            );

            const responses = await Promise.all(
                seasons.map((s) => this.client.getGuildRaidBySeason(apiKey, s)),
            );

            const allEntries = responses.flatMap((resp) => resp?.entries ?? []);

            if (allEntries.length === 0) {
                return null;
            }

            const rarities = rarity ? expandRarity(rarity) : null;
            const entries = allEntries.filter((entry) => {
                const isOneShot =
                    entry.remainingHp === 0 &&
                    entry.damageDealt === entry.maxHp;

                return (
                    (!rarities || rarities.includes(entry.rarity)) &&
                    entry.damageType === DamageType.BATTLE &&
                    (entry.remainingHp > 0 || isOneShot)
                );
            });

            if (entries.length === 0) {
                return null;
            }

            const unknownTracker = createUnknownUserTracker();
            for (const entry of entries) {
                const player = players.find((p) => p.userId === entry.userId);
                if (player) {
                    entry.userId = player.displayName;
                } else {
                    entry.userId = unknownTracker.getLabel(entry.userId);
                }
            }

            const entriesByBoss: Record<string, Raid[]> = {};
            for (const entry of entries) {
                if (!entry.userId) continue;
                const bossKey = `${entry.rarity}_${entry.unitId}`;
                if (!entriesByBoss[bossKey]) {
                    entriesByBoss[bossKey] = [];
                }
                entriesByBoss[bossKey].push(entry);
            }

            const guildAvgPerBoss: Record<string, number> = {};
            const playerStatsPerBoss: Record<
                string,
                Record<string, { totalDamage: number; tokens: number }>
            > = {};

            for (const [boss, bossEntries] of Object.entries(entriesByBoss)) {
                let totalDamage = 0;
                let totalTokens = 0;
                const perPlayer: Record<
                    string,
                    { totalDamage: number; tokens: number }
                > = {};

                for (const entry of bossEntries) {
                    const username = entry.userId;
                    totalDamage += entry.damageDealt;
                    totalTokens += 1;

                    if (!perPlayer[username]) {
                        perPlayer[username] = { totalDamage: 0, tokens: 0 };
                    }
                    perPlayer[username].totalDamage += entry.damageDealt;
                    perPlayer[username].tokens += 1;
                }

                guildAvgPerBoss[boss] =
                    totalTokens > 0 ? totalDamage / totalTokens : 0;
                playerStatsPerBoss[boss] = perPlayer;
            }

            const allPlayers = new Set<string>();
            for (const perPlayer of Object.values(playerStatsPerBoss)) {
                for (const username of Object.keys(perPlayer)) {
                    allPlayers.add(username);
                }
            }

            const result: Record<string, number> = {};

            for (const username of allPlayers) {
                if (username.startsWith("Unknown #")) {
                    continue;
                }
                let weightedSum = 0;
                let totalWeight = 0;

                for (const [boss, perPlayer] of Object.entries(
                    playerStatsPerBoss,
                )) {
                    const playerStats = perPlayer[username];
                    const guildAvg = guildAvgPerBoss[boss];

                    if (!playerStats || !guildAvg || guildAvg === 0) {
                        continue;
                    }

                    if (playerStats.tokens < MIN_HITS_PER_BOSS) {
                        continue;
                    }

                    const playerAvg =
                        playerStats.totalDamage / playerStats.tokens;
                    const relativePerformance = playerAvg / guildAvg;
                    const weight = playerStats.tokens;

                    weightedSum += weight * relativePerformance;
                    totalWeight += weight;
                }

                if (totalWeight > 0) {
                    result[username] = (weightedSum / totalWeight) * 100;
                }
            }

            return Object.keys(result).length > 0 ? result : null;
        } catch (error) {
            logger.error(
                error,
                "Error calculating weighted relative performance",
            );
            return null;
        }
    }

    async getTokenByHours(discordId: string) {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                logger.error("No API key found for user:", discordId);
                return null;
            }

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);

            if (!currentSeason || !currentSeason.season) {
                logger.error("No current season found for user:", discordId);
                return null;
            }

            const prevSeason = await this.client.getGuildRaidBySeason(
                apiKey,
                currentSeason.season - 1,
            );

            if (!prevSeason || !prevSeason.entries) {
                logger.error(
                    "No previous season entries found for user:",
                    discordId,
                );
                return null;
            }

            const timeline: Record<number, number> = {};
            for (let i = 0; i < 24; i++) {
                timeline[i] = 0;
            }

            const raids = currentSeason.entries
                .concat(prevSeason.entries)
                .filter((raid) => raid.damageType === DamageType.BATTLE);

            raids.forEach((raid) => {
                if (!raid.startedOn) {
                    return;
                }

                const date = new Date(raid.startedOn * 1000);
                const hour = date.getUTCHours();
                if (!(hour in timeline)) {
                    throw new Error(
                        `Hour ${hour} not found in timeline for user: ${discordId}`,
                    );
                }
                timeline[hour]!++;
            });

            return timeline;
        } catch (error) {
            logger.error(error, "Error fetching token timeline: ");
            return null;
        }
    }

    async getPrimeROI(
        discordId: string,
        season?: number,
        rarity?: Rarity,
    ): Promise<{
        summary: {
            primeTokens: number;
            sideTokens: number;
            primeDmgPerToken: number;
            sideDmgPerToken: number;
            primePct: number;
        };
        players: {
            player: string;
            primeTokens: number;
            sideTokens: number;
            primeDmgPerToken: number;
            sideDmgPerToken: number;
            primePct: number;
        }[];
    } | null> {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) return null;

            const guildService = new GuildService(this.client);
            const players = await guildService.fetchGuildMembers(discordId);
            if (!players) return null;

            let seasonNumber = season;
            if (!seasonNumber) {
                const current =
                    await this.client.getGuildRaidByCurrentSeason(apiKey);
                if (!current?.season) return null;
                seasonNumber = current.season;
            }

            const response = await this.client.getGuildRaidBySeason(
                apiKey,
                seasonNumber,
            );
            const allEntries = response?.entries ?? [];
            if (allEntries.length === 0) return null;

            const rarities = rarity ? expandRarity(rarity) : null;
            const entries = allEntries.filter(
                (entry) =>
                    entry.damageType === DamageType.BATTLE &&
                    (!rarities || rarities.includes(entry.rarity)),
            );

            if (entries.length === 0) return null;

            const unknownTracker = createUnknownUserTracker();
            for (const entry of entries) {
                const player = players.find((p) => p.userId === entry.userId);
                if (player) {
                    entry.userId = player.displayName;
                } else {
                    entry.userId = unknownTracker.getLabel(entry.userId);
                }
            }

            // Split by encounter type
            const primeEntries = entries.filter(
                (e) => e.encounterType === EncounterType.BOSS,
            );
            const sideEntries = entries.filter(
                (e) => e.encounterType === EncounterType.SIDE_BOSS,
            );

            const primeTotalDmg = primeEntries.reduce(
                (s, e) => s + e.damageDealt,
                0,
            );
            const sideTotalDmg = sideEntries.reduce(
                (s, e) => s + e.damageDealt,
                0,
            );
            const primeDmgPerToken =
                primeEntries.length > 0
                    ? primeTotalDmg / primeEntries.length
                    : 0;
            const sideDmgPerToken =
                sideEntries.length > 0 ? sideTotalDmg / sideEntries.length : 0;
            const totalTokens = primeEntries.length + sideEntries.length;
            const primePct =
                totalTokens > 0 ? (primeEntries.length / totalTokens) * 100 : 0;

            // Per-player breakdown
            const playerMap: Record<
                string,
                {
                    primeDmg: number;
                    primeTokens: number;
                    sideDmg: number;
                    sideTokens: number;
                }
            > = {};
            for (const entry of entries) {
                if (entry.userId.startsWith("Unknown #")) continue;
                if (!playerMap[entry.userId]) {
                    playerMap[entry.userId] = {
                        primeDmg: 0,
                        primeTokens: 0,
                        sideDmg: 0,
                        sideTokens: 0,
                    };
                }
                const p = playerMap[entry.userId]!;
                if (entry.encounterType === EncounterType.BOSS) {
                    p.primeDmg += entry.damageDealt;
                    p.primeTokens += 1;
                } else {
                    p.sideDmg += entry.damageDealt;
                    p.sideTokens += 1;
                }
            }

            const playerResults = Object.entries(playerMap)
                .map(([player, stats]) => {
                    const total = stats.primeTokens + stats.sideTokens;
                    return {
                        player,
                        primeTokens: stats.primeTokens,
                        sideTokens: stats.sideTokens,
                        primeDmgPerToken:
                            stats.primeTokens > 0
                                ? stats.primeDmg / stats.primeTokens
                                : 0,
                        sideDmgPerToken:
                            stats.sideTokens > 0
                                ? stats.sideDmg / stats.sideTokens
                                : 0,
                        primePct:
                            total > 0 ? (stats.primeTokens / total) * 100 : 0,
                    };
                })
                .sort((a, b) => b.primePct - a.primePct);

            return {
                summary: {
                    primeTokens: primeEntries.length,
                    sideTokens: sideEntries.length,
                    primeDmgPerToken: Math.round(primeDmgPerToken),
                    sideDmgPerToken: Math.round(sideDmgPerToken),
                    primePct: Math.round(primePct),
                },
                players: playerResults,
            };
        } catch (error) {
            logger.error(error, "Error calculating prime ROI");
            return null;
        }
    }
}
