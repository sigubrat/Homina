import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController } from "@/lib";
import { resolveGuildMembers } from "@/lib/utils/guildMemberUtils";
import { createUnknownUserTracker } from "@/lib/utils/userUtils";
import { getPrimeDisplayName, mapTierToRarity } from "@/lib/utils/utils";
import { expandRarity } from "@/lib/utils/rarityUtils";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import { BotError } from "@/models/errors/BotError";
import { DatabaseError, ExternalApiError } from "@/models/errors/ServiceError";
import { NotRegisteredError } from "@/models/errors/UserError";
import type { GuildRaidResult, Raid } from "@/models/types";
import { MINIMUM_SEASON_THRESHOLD } from "../configs/constants";

export class RaidAnalyticsService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    private async resolveGuildMembers(discordId: string) {
        return resolveGuildMembers(discordId, this.client, this.db);
    }

    private async requireApiKey(discordId: string): Promise<string> {
        let apiKey: string | null;
        try {
            apiKey = await this.db.getUserToken(discordId);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to retrieve API token", {
                cause: error,
                context: { discordId },
            });
        }
        if (!apiKey) throw new NotRegisteredError();
        return apiKey;
    }

    async getGuildRaidResultBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
        includePrimes: boolean = true,
    ): Promise<GuildRaidResult[]> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
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
                            (existingEntry.primeDamage ?? 0) +
                            entry.damageDealt;
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
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch guild raid results", {
                cause: error,
                context: { discordId, season },
            });
        }
    }

    async getGuildRaidResultByRaritySeasonPerBoss(
        discordId: string,
        season: number,
        rarity?: Rarity,
        filterBombs: boolean = false,
        encounterTypeFilter?: EncounterType,
    ) {
        try {
            const apiKey = await this.requireApiKey(discordId);
            const players = await this.resolveGuildMembers(discordId);

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
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
            const playerNames = new Map<string, string>(
                players.map((p) => [p.userId, p.displayName]),
            );

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

                const username =
                    playerNames.get(entry.userId) ??
                    unknownTracker.getLabel(entry.userId);

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
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError(
                "Failed to fetch guild raid results by boss",
                {
                    cause: error,
                    context: { discordId, season },
                },
            );
        }
    }

    async getGuildRaidBombsBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ): Promise<Record<string, number>> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            let entries: Raid[] = resp.entries;

            if (rarity) {
                const rarities = expandRarity(rarity);
                entries = entries.filter((entry) =>
                    rarities.includes(entry.rarity),
                );
            }

            const bombs = entries.filter(
                (entry) => entry.damageType === DamageType.BOMB,
            );

            const bombsPerUser: Record<string, number> = {};
            for (const bomb of bombs) {
                const username = bomb.userId;
                bombsPerUser[username] = (bombsPerUser[username] ?? 0) + 1;
            }

            return bombsPerUser;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch guild raid bombs", {
                cause: error,
                context: { discordId, season },
            });
        }
    }

    async getGuildRaidBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ) {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);

            if (rarity) {
                const rarities = expandRarity(rarity);
                resp.entries = resp.entries.filter((entry) =>
                    rarities.includes(entry.rarity),
                );
            }

            return resp.entries;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch guild raid by season", {
                cause: error,
                context: { discordId, season },
            });
        }
    }

    async getMemberStatsInLastSeasons(
        discordId: string,
        nSeasons: number,
        rarity?: Rarity,
    ) {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!currentSeason || !currentSeason.season) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
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
            if (error instanceof BotError) throw error;
            throw new ExternalApiError(
                "Failed to fetch member stats across seasons",
                {
                    cause: error,
                    context: { discordId },
                },
            );
        }
    }

    async getWeightedRelativePerformance(
        discordId: string,
        season: number,
        rarity?: Rarity,
        seasonCount: number = 1,
    ): Promise<Record<string, number>> {
        const MIN_HITS_PER_BOSS = 2;

        try {
            const apiKey = await this.requireApiKey(discordId);
            const players = await this.resolveGuildMembers(discordId);

            const seasons = Array.from(
                { length: seasonCount },
                (_, i) => season - seasonCount + 1 + i,
            );

            const responses = await Promise.all(
                seasons.map((s) => this.client.getGuildRaidBySeason(apiKey, s)),
            );

            const allEntries = responses.flatMap((resp) => resp?.entries ?? []);

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

            const unknownTracker = createUnknownUserTracker();
            const playerNames = new Map<string, string>(
                players.map((p) => [p.userId, p.displayName]),
            );

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
                    const username =
                        playerNames.get(entry.userId) ??
                        unknownTracker.getLabel(entry.userId);
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

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError(
                "Failed to calculate weighted relative performance",
                {
                    cause: error,
                    context: { discordId, season },
                },
            );
        }
    }

    async getTokenByHours(discordId: string) {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);

            if (!currentSeason || !currentSeason.season) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
            }

            const prevSeason = await this.client.getGuildRaidBySeason(
                apiKey,
                currentSeason.season - 1,
            );

            if (!prevSeason || !prevSeason.entries) {
                throw new ExternalApiError("No previous season data returned", {
                    context: { discordId },
                });
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
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch token timeline", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getPrimeSpecialists(
        discordId: string,
        rarity: Rarity,
        season?: number,
    ): Promise<{
        primes: Record<
            string,
            { player: string; avgDmg: number; tokens: number; unitId: string }[]
        >;
        seasonsUsed: number[];
    } | null> {
        try {
            const apiKey = await this.requireApiKey(discordId);
            const players = await this.resolveGuildMembers(discordId);

            let seasonNumber = season;
            if (!seasonNumber) {
                const current =
                    await this.client.getGuildRaidByCurrentSeason(apiKey);
                if (!current?.season) return null;
                seasonNumber = current.season;
            }

            const seasonsToFetch = [seasonNumber];
            for (let i = 1; i <= 5; i++) {
                const priorSeason = seasonNumber - i;
                if (priorSeason >= MINIMUM_SEASON_THRESHOLD) {
                    seasonsToFetch.push(priorSeason);
                }
            }

            const responses = await Promise.all(
                seasonsToFetch.map((s) =>
                    this.client
                        .getGuildRaidBySeason(apiKey, s)
                        .catch(() => null),
                ),
            );

            const rarities = expandRarity(rarity);
            const targetEntries = responses[0]?.entries ?? [];
            const targetPrimeKeys = new Set<string>();
            for (const entry of targetEntries) {
                if (
                    entry.encounterType === EncounterType.SIDE_BOSS &&
                    rarities.includes(entry.rarity) &&
                    entry.damageType === DamageType.BATTLE
                ) {
                    targetPrimeKeys.add(
                        `${entry.unitId}_${entry.set}_${entry.rarity}`,
                    );
                }
            }

            if (targetPrimeKeys.size === 0) return null;

            const allEntries = responses.flatMap((resp) => resp?.entries ?? []);
            const primeEntries = allEntries.filter((entry) => {
                if (
                    entry.encounterType !== EncounterType.SIDE_BOSS ||
                    entry.damageType !== DamageType.BATTLE
                ) {
                    return false;
                }
                const key = `${entry.unitId}_${entry.set}_${entry.rarity}`;
                return targetPrimeKeys.has(key);
            });

            if (primeEntries.length === 0) return null;

            const seasonsUsed = new Set<number>();
            for (let i = 0; i < responses.length; i++) {
                const resp = responses[i];
                if (
                    resp?.entries?.some((e) => {
                        const key = `${e.unitId}_${e.set}_${e.rarity}`;
                        return (
                            e.encounterType === EncounterType.SIDE_BOSS &&
                            e.damageType === DamageType.BATTLE &&
                            targetPrimeKeys.has(key)
                        );
                    })
                ) {
                    seasonsUsed.add(seasonsToFetch[i]!);
                }
            }

            const unknownTracker = createUnknownUserTracker();
            const playerNames = new Map<string, string>(
                players.map((p) => [p.userId, p.displayName]),
            );

            const byPrime: Record<
                string,
                {
                    unitId: string;
                    players: Record<
                        string,
                        { totalDamage: number; tokens: number }
                    >;
                }
            > = {};
            for (const entry of primeEntries) {
                const playerName =
                    playerNames.get(entry.userId) ??
                    unknownTracker.getLabel(entry.userId);
                if (playerName.startsWith("Unknown #")) continue;

                const prefix = mapTierToRarity(
                    entry.tier,
                    entry.set + 1,
                    false,
                );
                const primeKey = `${prefix} ${getPrimeDisplayName(entry.unitId)}`;
                if (!byPrime[primeKey]) {
                    byPrime[primeKey] = { unitId: entry.unitId, players: {} };
                }
                const primePlayers = byPrime[primeKey].players;

                if (!primePlayers[playerName]) {
                    primePlayers[playerName] = { totalDamage: 0, tokens: 0 };
                }
                primePlayers[playerName]!.totalDamage += entry.damageDealt;
                primePlayers[playerName]!.tokens += 1;
            }

            const result: Record<
                string,
                {
                    player: string;
                    avgDmg: number;
                    tokens: number;
                    unitId: string;
                }[]
            > = {};
            for (const [
                prime,
                { unitId, players: playerStats },
            ] of Object.entries(byPrime)) {
                const ranked = Object.entries(playerStats)
                    .filter(([, stats]) => stats.tokens >= 2)
                    .map(([player, stats]) => ({
                        player,
                        avgDmg: stats.totalDamage / stats.tokens,
                        tokens: stats.tokens,
                        unitId,
                    }))
                    .sort((a, b) => b.avgDmg - a.avgDmg)
                    .slice(0, 3);

                if (ranked.length > 0) {
                    result[prime] = ranked;
                }
            }

            return Object.keys(result).length > 0
                ? {
                      primes: result,
                      seasonsUsed: [...seasonsUsed].sort((a, b) => a - b),
                  }
                : null;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError(
                "Failed to calculate prime specialists",
                {
                    cause: error,
                    context: { discordId },
                },
            );
        }
    }

    async getActivityByHourPerPlayer(
        discordId: string,
        nSeasons: number = 2,
    ): Promise<Record<string, Record<number, number>>> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);

            if (!currentSeason || !currentSeason.season) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
            }

            const seasonNumbers: number[] = [];
            for (let i = 0; i < nSeasons; i++) {
                const s = currentSeason.season - i;
                if (s < MINIMUM_SEASON_THRESHOLD) break;
                seasonNumbers.push(s);
            }

            const responses = await Promise.all(
                seasonNumbers.map((s) =>
                    s === currentSeason.season
                        ? Promise.resolve(currentSeason)
                        : this.client.getGuildRaidBySeason(apiKey, s),
                ),
            );

            const raids = responses
                .flatMap((resp) => resp?.entries ?? [])
                .filter((raid) => raid.damageType === DamageType.BATTLE);

            const result: Record<string, Record<number, number>> = {};

            for (const raid of raids) {
                if (!raid.startedOn) continue;

                if (!result[raid.userId]) {
                    const hours: Record<number, number> = {};
                    for (let i = 0; i < 24; i++) hours[i] = 0;
                    result[raid.userId] = hours;
                }

                const hour = new Date(raid.startedOn * 1000).getUTCHours();
                result[raid.userId]![hour]!++;
            }

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError(
                "Failed to fetch per-player activity by hour",
                {
                    cause: error,
                    context: { discordId },
                },
            );
        }
    }
}
