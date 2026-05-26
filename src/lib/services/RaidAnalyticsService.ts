import { HominaTacticusClient } from "@/client";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { DatabaseController, dbController, logger } from "@/lib";
import { createUnknownUserTracker } from "@/lib/utils/userUtils";
import { getPrimeDisplayName, mapTierToRarity } from "@/lib/utils/utils";
import { expandRarity } from "@/lib/utils/rarityUtils";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { GuildRaidResult, Raid } from "@/models/types";
import { MINIMUM_SEASON_THRESHOLD } from "../configs/constants";

export class RaidAnalyticsService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    private async getGuildId(discordId: string): Promise<string | null> {
        const cachedGuildId = await this.db.getGuildIdByUserId(discordId);
        if (cachedGuildId) return cachedGuildId;

        const apiKey = await this.db.getUserToken(discordId);
        if (!apiKey) return null;

        const resp = await this.client.getGuild(apiKey);
        if (!resp.success || !resp.guild) return null;

        const guildId = resp.guild.guildId;
        await this.db.updateGuildId(discordId, guildId);
        return guildId;
    }

    private async resolveGuildMembers(discordId: string) {
        const guildId = await this.getGuildId(discordId);
        if (!guildId) return null;

        const members = await fetchGuildMembers(guildId);
        if (!members) return null;

        const metadata = await this.db.getAllPlayerMetadataByGuild(guildId);
        if (metadata.length > 0) {
            const nicknameMap = new Map<string, string>();
            for (const entry of metadata) {
                if (entry.nickname) {
                    nicknameMap.set(entry.userId, entry.nickname);
                }
            }
            for (const member of members) {
                const nickname = nicknameMap.get(member.userId);
                if (nickname) {
                    member.displayName = nickname;
                }
            }
        }

        return members;
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

        const players = await this.resolveGuildMembers(discordId);
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

            const players = await this.resolveGuildMembers(discordId);
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
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) return null;

            const players = await this.resolveGuildMembers(discordId);
            if (!players) return null;

            // Determine target season
            let seasonNumber = season;
            if (!seasonNumber) {
                const current =
                    await this.client.getGuildRaidByCurrentSeason(apiKey);
                if (!current?.season) return null;
                seasonNumber = current.season;
            }

            // Fetch target season + last 5 prior seasons
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

            // Find which primes are active in the target season
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

            // Collect matching entries from all seasons (same unitId+set+rarity)
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

            // Track which seasons actually contributed data
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

            // Resolve player names
            const unknownTracker = createUnknownUserTracker();
            for (const entry of primeEntries) {
                const player = players.find((p) => p.userId === entry.userId);
                if (player) {
                    entry.userId = player.displayName;
                } else {
                    entry.userId = unknownTracker.getLabel(entry.userId);
                }
            }

            // Group by prime, then by player
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
                if (entry.userId.startsWith("Unknown #")) continue;

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

                if (!primePlayers[entry.userId]) {
                    primePlayers[entry.userId] = { totalDamage: 0, tokens: 0 };
                }
                primePlayers[entry.userId]!.totalDamage += entry.damageDealt;
                primePlayers[entry.userId]!.tokens += 1;
            }

            // Compute top 3 per prime by avg damage per token
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
            logger.error(error, "Error calculating prime specialists");
            return null;
        }
    }
}
