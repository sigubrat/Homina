import { HominaTacticusClient } from "@/client";
import { dbController, logger } from "@/lib";
import { SecondsToString } from "../utils/timeUtils";
import { evaluateToken } from "../utils/timeUtils";
import { getUnixTimestamp } from "../utils/timeUtils";
import { getMetaTeam } from "@/lib/utils/metaTeamUtils";
import { createUnknownUserTracker } from "@/lib/utils/userUtils";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import { MetaTeams } from "@/models/enums/MetaTeams";
import type {
    GuildRaidAvailable,
    GuildRaidResult,
    Raid,
    TokensAndBombs,
    TokenStatus,
} from "@/models/types";
import type { TeamDistribution } from "@/models/types/TeamDistribution";
import { MINIMUM_SEASON_THRESHOLD } from "../configs/constants";
import { testApiToken } from "../utils/commandUtils";
import { fetchGuildMembers } from "@/client/MiddlewareClient";

/**
 * Service class for managing guild-related operations in the Homina Tacticus application.
 *
 * Provides methods for:
 * - Fetching and updating guild and member information.
 * - Managing player tokens and usernames.
 * - Retrieving and analyzing guild raid results, including meta team distributions and cooldowns.
 * - Handling transactional updates and deletions of guild members.
 * - Calculating available tokens and bombs for guild members.
 *
 * Utilizes the HominaTacticusClient for API interactions and dbController for database operations.
 * All methods are asynchronous and handle errors gracefully, logging them and returning null or default values as appropriate.
 *
 * @remarks
 * This service is intended to be used as a backend utility for Discord bots or web applications that require guild management features for Tacticus.
 *
 * @example
 * ```typescript
 * const guildService = new GuildService();
 * const guildId = await guildService.getGuildId(discordUserId);
 * const members = await guildService.getGuildMembers(discordUserId);
 * ```
 */
export class GuildService {
    private client: HominaTacticusClient;

    constructor() {
        this.client = new HominaTacticusClient();
    }

    /**
     * Expands a rarity value into an array of concrete rarities.
     * Maps LEGENDARY_PLUS to [LEGENDARY, MYTHIC]; all others map to a single-element array.
     */
    private expandRarity(rarity: Rarity): Rarity[] {
        if (rarity === Rarity.LEGENDARY_PLUS) {
            return [Rarity.LEGENDARY, Rarity.MYTHIC];
        }
        return [rarity];
    }

    /**
     * Fetches the guild ID for a given user ID.
     * Retrieves from database first (faster), falls back to API for older registrations.
     * @param discordId The ID of the user to fetch the guild ID for.
     * @returns The guild ID or null if not found or an error occurred.
     */
    async getGuildId(discordId: string): Promise<string | null> {
        try {
            // First try to get from database (faster, no API call)
            const cachedGuildId =
                await dbController.getGuildIdByUserId(discordId);
            if (cachedGuildId) {
                return cachedGuildId;
            }

            // Fallback to API if not in database (for older registrations)
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                return null;
            }

            // Cache the guildId for future use
            const guildId = resp.guild.guildId;
            await dbController.updateGuildId(discordId, guildId);

            return guildId;
        } catch (error) {
            logger.error(error, "Error fetching guild ID");
            return null;
        }
    }

    /**
     * Fetches the members of a guild for a given user ID.
     * @param discordId The ID of the user to fetch guild members for.
     * @returns A list of user IDs of the guild members or null if an error occurred.
     */
    async getGuildMembers(discordId: string): Promise<string[] | null> {
        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                throw new Error("API key not found for user: " + discordId);
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                throw new Error("Failed to fetch guild for user: " + discordId);
            }

            return resp.guild.members.map((member) => member.userId);
        } catch (error) {
            logger.error(error, "Error fetching guild members");
            return null;
        }
    }

    /**
     * Tests the registered guild API token for a given user ID.
     * @param userId The ID of the user to test the API token for.
     * @returns An object containing the status and message of the test.
     */
    async testRegisteredGuildApiToken(
        userId: string,
    ): Promise<{ status: boolean; message: string }> {
        try {
            const apiToken = await dbController.getUserToken(userId);
            if (!apiToken) {
                return {
                    status: false,
                    message: "No API token found for user",
                };
            }

            const resp = await testApiToken(apiToken);
            if (!resp) {
                return { status: false, message: "Invalid API token" };
            }
            return { status: true, message: "API token is valid" };
        } catch (error) {
            logger.error(error, "Error testing player API token");
            return {
                status: false,
                message:
                    "Something went horribly wrong while testing your token. Please register it again.",
            };
        }
    }

    /**
     * Fetches the seasons of the guild for a given user ID.
     * @param userId The ID of the user to fetch guild seasons for.
     * @returns A list of seasons or null if an error occurred.
     */
    async getGuildSeasons(userId: string): Promise<number[] | null> {
        try {
            const apiKey = await dbController.getUserToken(userId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                return null;
            }

            return resp.guild.guildRaidSeasons;
        } catch (error) {
            logger.error(error, "Error fetching guild seasons: ");
            return null;
        }
    }

    /**
     * Fetches the guild raid results for a given user ID and season.
     * @param discordId The ID of the user to fetch guild raid results for.
     * @param season The season to fetch results for.
     * @param rarity Optional rarity filter for the raid results.
     * @param includePrimes Whether to include prime encounters in the results.
     * @returns A list of GuildRaidResult objects or null if an error occurred.
     */
    async getGuildRaidResultBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
        includePrimes: boolean = true,
    ): Promise<GuildRaidResult[] | null> {
        const apiKey = await dbController.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            const rarities = this.expandRarity(rarity);
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
                    continue; // Bombs don't count as damage
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
                // Track prime damage separately
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

    /**
     * Fetches the guild raid results grouped by rarity and season for each boss.
     * @param discordId The ID of the user to fetch guild raid results for.
     * @param season The season to fetch results for.
     * @param rarity Optional rarity filter for the raid results.
     * @returns A record of boss names to their respective GuildRaidResult arrays or null if an error occurred.
     */
    async getGuildRaidResultByRaritySeasonPerBoss(
        discordId: string,
        season: number,
        rarity?: Rarity,
        filterBombs: boolean = false,
    ) {
        const apiKey = await dbController.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const players = await this.fetchGuildMembers(discordId);
        if (!players) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            const rarities = this.expandRarity(rarity);
            entries = entries.filter((entry) =>
                rarities.includes(entry.rarity),
            );
        }

        if (filterBombs) {
            entries = entries.filter(
                (entry) => entry.damageType !== DamageType.BOMB,
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

            const boss = entry.type;

            if (!groupedResults[boss]) {
                groupedResults[boss] = [];
            }

            const username = entry.userId;

            const existingUserEntry = groupedResults[boss].find(
                (e) => e.username === username,
            );

            if (existingUserEntry) {
                // Bombs don't count as damage, but we want to know how many bombs were used
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
                if (entry.damageType === DamageType.BOMB) {
                    groupedResults[boss].push({
                        bombCount: 1,
                        username: username,
                        totalDamage: 0,
                        totalTokens: 0,
                        primeDamage: 0,
                        boss: entry.type,
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
                        boss: entry.type,
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
        const apiKey = await dbController.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const guildId = await this.getGuildId(discordId);
        if (!guildId) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            const rarities = this.expandRarity(rarity);
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

    /**
     * Fetches the meta team distribution for a given user ID and season.
     * @param discordId The ID of the user to fetch meta team distribution for.
     * @param season The season to fetch results for.
     * @param tier Optional rarity filter for the raid results.
     * @returns A TeamDistribution object or null if an error occurred.
     */
    async getMetaTeamDistribution(
        discordId: string,
        season: number,
        tier?: Rarity,
    ) {
        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            let entries: Raid[] = resp.entries;

            if (tier) {
                const rarities = this.expandRarity(tier);
                entries = entries.filter((entry) =>
                    rarities.includes(entry.rarity),
                );
            }

            const totalDistribution: TeamDistribution = {
                mech: 0,
                multihit: 0,
                neuro: 0,
                mechDamage: 0,
                multihitDamage: 0,
                neuroDamage: 0,
                other: 0,
                otherDamage: 0,
                custodes: 0,
                battlesuit: 0,
                battlesuitDamage: 0,
            };

            for (const entry of entries) {
                // bombs and sideboss don't count as damage
                if (
                    !entry.userId ||
                    entry.damageType === DamageType.BOMB ||
                    entry.encounterType === EncounterType.SIDE_BOSS
                ) {
                    continue;
                }

                const heroes = entry.heroDetails.map((hero) => hero.unitId);

                const team = getMetaTeam(heroes);

                if (team === MetaTeams.ADMECH) {
                    // Check if the team has a lynchpin hero
                    totalDistribution.mech = (totalDistribution.mech || 0) + 1;
                    totalDistribution.mechDamage =
                        (totalDistribution.mechDamage || 0) + entry.damageDealt;
                } else if (team === MetaTeams.MULTIHIT) {
                    totalDistribution.multihit =
                        (totalDistribution.multihit || 0) + 1;
                    totalDistribution.multihitDamage =
                        (totalDistribution.multihitDamage || 0) +
                        entry.damageDealt;
                } else if (team === MetaTeams.NEURO) {
                    totalDistribution.neuro =
                        (totalDistribution.neuro || 0) + 1;
                    totalDistribution.neuroDamage =
                        (totalDistribution.neuroDamage || 0) +
                        entry.damageDealt;
                } else if (team === MetaTeams.CUSTODES) {
                    totalDistribution.custodes =
                        (totalDistribution.custodes || 0) + 1;
                    totalDistribution.custodesDamage =
                        (totalDistribution.custodesDamage || 0) +
                        entry.damageDealt;
                } else if (team === MetaTeams.BATTLESUIT) {
                    totalDistribution.battlesuit =
                        (totalDistribution.battlesuit || 0) + 1;
                    totalDistribution.battlesuitDamage =
                        (totalDistribution.battlesuitDamage || 0) +
                        entry.damageDealt;
                } else {
                    totalDistribution.other =
                        (totalDistribution.other || 0) + 1;
                    totalDistribution.otherDamage =
                        (totalDistribution.otherDamage || 0) +
                        entry.damageDealt;
                }
            }

            return totalDistribution;
        } catch (error) {
            logger.error(error, "Error fetching guild seasons: ");
            return null;
        }
    }

    /**
     * Fetches the meta team distribution per player for a given user ID and season.
     * @param discordId The ID of the user to fetch meta team distribution for.
     * @param season The season to fetch results for.
     * @param tier Optional rarity filter for the raid results.
     * @returns A record of usernames to their respective TeamDistribution objects or null if an error occurred.
     */
    async getMetaTeamDistributionPerPlayer(
        discordId: string,
        season: number,
        tier?: Rarity,
    ) {
        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const guildId = await this.getGuildId(discordId);
            if (!guildId) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            let entries: Raid[] = resp.entries;

            if (tier) {
                const rarities = this.expandRarity(tier);
                entries = entries.filter((entry) =>
                    rarities.includes(entry.rarity),
                );
            }

            const groupedResults: Record<string, Raid[]> = {};
            for (const entry of entries) {
                const username = entry.userId;
                // bombs and sideboss don't count as damage
                if (
                    !entry.userId ||
                    entry.damageType === DamageType.BOMB ||
                    entry.encounterType === EncounterType.SIDE_BOSS
                ) {
                    continue;
                }

                // Ensure groupedResults[username] is initialized
                if (!groupedResults[username]) {
                    groupedResults[username] = [];
                }

                groupedResults[username].push(entry);
            }

            const result: Record<string, TeamDistribution> = {};
            for (const username in groupedResults) {
                const entries = groupedResults[username];

                if (!entries) {
                    continue;
                }

                const totalDistribution: TeamDistribution = {
                    mech: 0,
                    multihit: 0,
                    neuro: 0,
                    custodes: 0,
                    mechDamage: 0,
                    multihitDamage: 0,
                    neuroDamage: 0,
                    other: 0,
                    otherDamage: 0,
                    custodesDamage: 0,
                    battlesuit: 0,
                    battlesuitDamage: 0,
                };

                for (const entry of entries) {
                    // bombs and sideboss don't count as damage
                    if (
                        !entry.userId ||
                        entry.damageType === DamageType.BOMB ||
                        entry.encounterType === EncounterType.SIDE_BOSS
                    ) {
                        continue;
                    }

                    const heroes = entry.heroDetails.map((hero) => hero.unitId);

                    const metaTeam = getMetaTeam(heroes);

                    switch (metaTeam) {
                        case MetaTeams.ADMECH:
                            totalDistribution.mech =
                                (totalDistribution.mech || 0) + 1;
                            totalDistribution.mechDamage =
                                (totalDistribution.mechDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.MULTIHIT:
                            totalDistribution.multihit =
                                (totalDistribution.multihit || 0) + 1;
                            totalDistribution.multihitDamage =
                                (totalDistribution.multihitDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.NEURO:
                            totalDistribution.neuro =
                                (totalDistribution.neuro || 0) + 1;
                            totalDistribution.neuroDamage =
                                (totalDistribution.neuroDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.CUSTODES:
                            totalDistribution.custodes =
                                (totalDistribution.custodes || 0) + 1;
                            totalDistribution.custodesDamage =
                                (totalDistribution.custodesDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.BATTLESUIT:
                            totalDistribution.battlesuit =
                                (totalDistribution.battlesuit || 0) + 1;
                            totalDistribution.battlesuitDamage =
                                (totalDistribution.battlesuitDamage || 0) +
                                entry.damageDealt;
                            break;
                        default:
                            totalDistribution.other =
                                (totalDistribution.other || 0) + 1;
                            totalDistribution.otherDamage =
                                (totalDistribution.otherDamage || 0) +
                                entry.damageDealt;
                    }
                }

                // Calculate percentages
                const totalEntries = entries.length;
                const totalDamage =
                    totalDistribution.mechDamage! +
                    totalDistribution.multihitDamage! +
                    totalDistribution.neuroDamage! +
                    totalDistribution.custodesDamage! +
                    totalDistribution.battlesuitDamage! +
                    totalDistribution.otherDamage!;

                if (totalDamage === 0 || totalEntries === 0) {
                    result[username] = {
                        mech: 0,
                        multihit: 0,
                        neuro: 0,
                        custodes: 0,
                        other: 0,
                        mechDamage: 0,
                        multihitDamage: 0,
                        neuroDamage: 0,
                        custodesDamage: 0,
                        battlesuit: 0,
                        battlesuitDamage: 0,
                        otherDamage: 0,
                    };
                    continue;
                }

                const percentages: TeamDistribution = {
                    mech: (totalDistribution.mech / totalEntries) * 100,
                    multihit: (totalDistribution.multihit / totalEntries) * 100,
                    neuro: (totalDistribution.neuro / totalEntries) * 100,
                    custodes: (totalDistribution.custodes / totalEntries) * 100,
                    other: (totalDistribution.other / totalEntries) * 100,
                    battlesuit:
                        (totalDistribution.battlesuit / totalEntries) * 100,
                    mechDamage:
                        (totalDistribution.mechDamage! / totalDamage) * 100,
                    multihitDamage:
                        (totalDistribution.multihitDamage! / totalDamage) * 100,
                    neuroDamage:
                        (totalDistribution.neuroDamage! / totalDamage) * 100,
                    otherDamage:
                        (totalDistribution.otherDamage! / totalDamage) * 100,
                    custodesDamage:
                        (totalDistribution.custodesDamage! / totalDamage) * 100,
                    battlesuitDamage:
                        (totalDistribution.battlesuitDamage! / totalDamage) *
                        100,
                };

                result[username] = percentages;
            }

            return result;
        } catch (error) {
            logger.error(error, "Error fetching guild seasons: ");
            return null;
        }
    }

    /**
     * Fetches the available tokens and bombs for a given user ID.
     * @param discordId The ID of the user to fetch available tokens and bombs for.
     * @returns A record of usernames to their respective GuildRaidAvailable objects or null if an error occurred.
     */
    async getAvailableTokensAndBombs(discordId: string) {
        const TOKENCOOLDOWNINSECONDS = 12 * 60 * 60;
        const BOMBCOOLDOWNINSECONDS = 18 * 60 * 60;
        const BOMBCOOLDOWNHOURS = 18;
        const MAXTOKENS = 3;
        const now = new Date();

        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!resp || !resp.entries) {
                return null;
            }

            const prevSeason = await this.client.getGuildRaidBySeason(
                apiKey,
                resp.season - 1,
            );

            const sortedEntries = prevSeason.entries
                .filter((e) => e.damageType !== DamageType.BOMB)
                .sort((a, b) => b.startedOn - a.startedOn);

            if (!prevSeason || !prevSeason.entries) {
                return null;
            }

            const prevUsers = new Set<string>();

            // Get the last entry of each user from the previous season
            for (const prevEntry of sortedEntries) {
                if (prevEntry.damageType === DamageType.BOMB) {
                    continue;
                }

                prevUsers.add(prevEntry.userId);
            }

            const guildId = await this.getGuildId(discordId);
            if (!guildId) {
                return null;
            }

            const currentMembersArr = await this.getGuildMembers(discordId);
            if (!currentMembersArr || currentMembersArr.length === 0) {
                return null;
            }

            const currentMembers = new Set(currentMembersArr);

            // Find out who have left the guild and therefore should not be included in the results
            const formerMembers = new Set(
                Array.from(prevUsers).filter(
                    (prevId) => !currentMembers.has(prevId),
                ),
            );

            const entries = resp.entries;

            const combinedEntries = entries.concat(prevSeason.entries);

            const users: Record<string, TokensAndBombs> = {};

            for (const entry of combinedEntries) {
                if (formerMembers.has(entry.userId)) {
                    // If the user has left the guild, we skip their entries
                    continue;
                }

                const id = entry.userId;

                if (!users[id]) {
                    users[id] = {
                        tokens: [],
                        bombs: [],
                    };
                }

                if (entry.damageType === DamageType.BOMB) {
                    users[id]?.bombs.push(entry);
                } else {
                    users[id]?.tokens.push(entry);
                }
            }

            // Find the most recent bomb used and up to 3 most recent tokens used
            const result: Record<string, GuildRaidAvailable> = {};

            await Promise.all(
                Object.entries(users).map(async ([userId, data]) => {
                    const temp: GuildRaidAvailable = {
                        tokens: MAXTOKENS,
                        bombs: 1,
                    };

                    const mostRecentBomb = data.bombs
                        .sort((a, b) => b.startedOn - a.startedOn)
                        .find(() => true);

                    if (mostRecentBomb) {
                        const diff =
                            getUnixTimestamp(now) - mostRecentBomb.startedOn;
                        const diffHours = Math.floor(diff / 3600);
                        if (diffHours < BOMBCOOLDOWNHOURS) {
                            temp.bombs = 0;
                            temp.bombCooldown = SecondsToString(
                                BOMBCOOLDOWNINSECONDS - diff,
                            );
                        } else {
                            temp.bombCooldown = SecondsToString(
                                diff - BOMBCOOLDOWNINSECONDS,
                                true,
                            );
                        }
                    }

                    const sortedTokensAsc = data.tokens.sort(
                        (a, b) => a.startedOn - b.startedOn,
                    );

                    const initialTimestamp =
                        sortedTokensAsc[0]?.startedOn ?? getUnixTimestamp(now);
                    let token: TokenStatus = {
                        refreshTime: initialTimestamp,
                        count: 2,
                    };

                    sortedTokensAsc
                        .filter((raid) => raid.startedOn !== null)
                        .forEach((raid) => {
                            token = evaluateToken(token, raid.startedOn);
                            token.count--;
                            if (token.count < 0) {
                                token.count = 0;
                                token.refreshTime = raid.startedOn;
                            }
                        });

                    token = evaluateToken(token, getUnixTimestamp(now));
                    if (token.count < MAXTOKENS) {
                        const tokenDiff =
                            getUnixTimestamp(now) - token.refreshTime;
                        temp.tokenCooldown = SecondsToString(
                            TOKENCOOLDOWNINSECONDS - tokenDiff,
                        );
                    }
                    temp.tokens = token.count;
                    result[userId] = temp;
                }),
            );

            return result;
        } catch (error) {
            logger.error(error, "Error fetching available tokens and bombs: ");
            return null;
        }
    }

    async getAvailableBombs(discordId: string) {
        const BOMBCOOLDOWNINSECONDS = 18 * 60 * 60;
        const BOMBCOOLDOWNHOURS = 18;
        const now = new Date();

        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);

            if (!resp || !resp.entries) {
                return null;
            }

            const userBombs: Record<string, Raid[]> = {};

            for (const entry of resp.entries) {
                // Only include bombs
                if (entry.damageType !== DamageType.BOMB) continue;
                userBombs[entry.userId] = userBombs[entry.userId] || [];
                userBombs[entry.userId]?.push(entry);
            }

            const result: Record<string, GuildRaidAvailable> = {};

            for (const [userId, bombs] of Object.entries(userBombs)) {
                const temp: GuildRaidAvailable = {
                    tokens: 3,
                    bombs: 1,
                };

                const mostRecentBomb = bombs
                    .sort((a, b) => b.startedOn - a.startedOn)
                    .find(() => true);

                if (mostRecentBomb) {
                    const diff =
                        getUnixTimestamp(now) - mostRecentBomb.startedOn;
                    const diffHours = Math.floor(diff / 3600);
                    if (diffHours < BOMBCOOLDOWNHOURS) {
                        temp.bombs = 0;
                        temp.bombCooldown = SecondsToString(
                            BOMBCOOLDOWNINSECONDS - diff,
                        );
                    } else {
                        temp.bombCooldown = SecondsToString(
                            diff - BOMBCOOLDOWNINSECONDS,
                            true,
                        );
                    }
                }

                result[userId] = temp;
            }

            return result;
        } catch (error) {
            logger.error(error, "Error fetching user bombs: ");
            return null;
        }
    }

    /**
     * Fetches the guild raid entries for a given user ID and season.
     * @param discordId The ID of the user to fetch guild raid entries for.
     * @param season The season to fetch entries for.
     * @param rarity Optional rarity filter for the raid entries.
     * @returns A list of Raid objects or null if an error occurred.
     */
    async getGuildRaidBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ) {
        const apiKey = await dbController.getUserToken(discordId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        if (rarity) {
            const rarities = this.expandRarity(rarity);
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

    async getPlayerCooldowns(token: string) {
        try {
            const resp = await this.client.getPlayer(token);
            if (!resp || !resp.player) {
                return null;
            }

            const player = resp.player;
            const status: GuildRaidAvailable = {
                tokens: player.progress.guildRaid?.tokens.current || 0,
                bombs: player.progress.guildRaid?.bombTokens.current || 0,
                tokenCooldown: player.progress.guildRaid?.tokens
                    .nextTokenInSeconds
                    ? SecondsToString(
                          player.progress.guildRaid.tokens.nextTokenInSeconds,
                      )
                    : undefined,
                bombCooldown: player.progress.guildRaid?.bombTokens
                    .nextTokenInSeconds
                    ? SecondsToString(
                          player.progress.guildRaid.bombTokens
                              .nextTokenInSeconds,
                      )
                    : undefined,
            };

            return status;
        } catch (error) {
            logger.error(error, "Error fetching player cooldowns: ");
            return null;
        }
    }

    /**
     * Retrieves a user's guild raid statistics for the last `nSeasons` seasons.
     *
     * @param discordId - The unique discord identifier of the user whose stats are being fetched.
     * @param nSeasons - The number of past seasons to retrieve statistics for.
     * @param rarity - (Optional) The rarity filter to apply when fetching raid results.
     * @returns A promise that resolves to an object mapping each season number to the corresponding guild raid results per boss,
     *          or `null` if an error occurs or required data is missing.
     *
     * @remarks
     * - Requires a valid API key for the user.
     * - If the current season or API key cannot be determined, the function returns `null`.
     * - Results are grouped by season and boss, filtered by the specified rarity if provided.
     * - Errors are logged and result in a `null` return value.
     */
    async getMemberStatsInLastSeasons(
        discordId: string,
        nSeasons: number,
        rarity?: Rarity,
    ) {
        try {
            const apiKey = await dbController.getUserToken(discordId);
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

    /**
     * Retrieves the configuration IDs for the last `nSeasons` seasons for a given Discord user.
     *
     * @param discordId - The Discord user ID to retrieve season configs for.
     * @param nSeasons - The number of previous seasons to retrieve configs for.
     * @returns A promise that resolves to an array of season configuration IDs, or `null` if the API key or current season is not found.
     *
     * @throws Will log an error and return `null` if the user does not have an API key or if the current season cannot be determined.
     */
    async getNLastSeasonConfigs(discordId: string, nSeasons: number) {
        const apikey = await dbController.getUserToken(discordId);
        if (!apikey) {
            logger.error("No API key found for user:", discordId);
            return null;
        }

        const currentSeason =
            await this.client.getGuildRaidByCurrentSeason(apikey);
        if (!currentSeason || !currentSeason.season) {
            logger.error("No current season found for user:", discordId);
            return null;
        }

        const currentSeasonNumber = currentSeason.season;
        const seasons: number[] = [];
        for (let i = nSeasons; i > 0; i--) {
            if (currentSeasonNumber - i < 70) {
                break;
            }
            seasons.push(currentSeasonNumber - i);
        }
        seasons.push(currentSeasonNumber);

        const seasonPromises = seasons.map(
            async (season) =>
                await this.client.getGuildRaidBySeason(apikey, season),
        );

        const responses = await Promise.all(seasonPromises);

        const configs = responses.map((resp) => ({
            config: Number(resp.seasonConfigId.at(-1)),
            season: resp.season,
        }));

        return configs;
    }

    /**
     * Retrieves a list of previous season numbers that share the same configuration as a specified season.
     *
     * @param discordId - The Discord user ID to retrieve the API key for.
     * @param nSeasons - The number of previous seasons to check.
     * @param season - The season number whose configuration should be matched.
     * @returns A promise that resolves to an array of season numbers with the same configuration as the specified season,
     *          or `null` if the API key or season configuration cannot be found.
     *
     * @throws Logs errors if the API key, current season, or desired season configuration cannot be found.
     *
     * @example
     * ```typescript
     * const matchingSeasons = await guildService.getSeasonsWithSameConfig('123456789', 5, 10);
     * // matchingSeasons might be: [5, 7, 9]
     * ```
     */
    async getSeasonsWithSameConfig(
        discordId: string,
        nSeasons: number,
        season: number,
    ) {
        const apikey = await dbController.getUserToken(discordId);
        if (!apikey) {
            logger.error("No API key found for user:", discordId);
            return null;
        }

        try {
            const desiredSeason = await this.client.getGuildRaidBySeason(
                apikey,
                season,
            );

            if (!desiredSeason || !desiredSeason.season) {
                logger.error("No current season found for user:", discordId);
                return null;
            }

            const desiredConfig = desiredSeason.seasonConfigId;

            if (!desiredConfig) {
                logger.error(
                    `No season config found for season ${season} for user:`,
                    discordId,
                );
                return null;
            }

            const currentSeasonNumber = desiredSeason.season;
            const seasons: number[] = [];
            for (let i = nSeasons; i > 0; i--) {
                if (currentSeasonNumber - i < 70) {
                    break;
                }
                seasons.push(currentSeasonNumber - i);
            }

            const seasonPromises = seasons.map(
                async (season) =>
                    await this.client
                        .getGuildRaidBySeason(apikey, season)
                        .catch(() => null),
            );

            const responses = await Promise.all(seasonPromises);

            const result = responses
                .filter(
                    (resp) =>
                        resp &&
                        resp.seasonConfigId.at(-1) === desiredConfig.at(-1),
                )
                .map((resp) => resp!.season);

            return result;
        } catch (error) {
            logger.error(
                error,
                `Error fetching desired season ${season} for user:`,
                discordId,
            );
        }
    }

    public async getTokenByHours(discordId: string) {
        try {
            const apiKey = await dbController.getUserToken(discordId);
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

            // Create a record with keys // as hours (0-23) and values as the number of tokens used in that hour
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

    /**
     * Calculates weighted relative performance per player against all bosses at a given rarity.
     * Excludes sweeps (remainingHp === 0) and bombs. Includes both bosses and sidebosses.
     *
     * For each boss, a player's average damage per token is compared to the guild average.
     * These ratios are combined via a weighted average (weighted by tokens used per boss).
     *
     * @param discordId The Discord ID of the requesting user.
     * @param season The season number.
     * @param rarity The rarity (or array of rarities) to filter by.
     * @returns A record of display names to their weighted relative performance percentage, or null.
     */
    async getWeightedRelativePerformance(
        discordId: string,
        season: number,
        rarity: Rarity,
    ): Promise<Record<string, number> | null> {
        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const players = await this.fetchGuildMembers(discordId);
            if (!players) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            // Filter to requested rarity/rarities, exclude bombs and sweeps
            const rarities = this.expandRarity(rarity);
            const entries = resp.entries.filter(
                (entry) =>
                    rarities.includes(entry.rarity) &&
                    entry.damageType === DamageType.BATTLE &&
                    entry.remainingHp > 0,
            );

            if (entries.length === 0) {
                return null;
            }

            // Replace user IDs with display names
            const unknownTracker = createUnknownUserTracker();
            for (const entry of entries) {
                const player = players.find((p) => p.userId === entry.userId);
                if (player) {
                    entry.userId = player.displayName;
                } else {
                    entry.userId = unknownTracker.getLabel(entry.userId);
                }
            }

            // Group entries by boss
            const entriesByBoss: Record<string, Raid[]> = {};
            for (const entry of entries) {
                if (!entry.userId) continue;
                const bossKey = entry.unitId;
                if (!entriesByBoss[bossKey]) {
                    entriesByBoss[bossKey] = [];
                }
                entriesByBoss[bossKey].push(entry);
            }

            // Calculate guild avg damage per token and per-player stats for each boss
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

            // Collect all unique players
            const allPlayers = new Set<string>();
            for (const perPlayer of Object.values(playerStatsPerBoss)) {
                for (const username of Object.keys(perPlayer)) {
                    allPlayers.add(username);
                }
            }

            // Calculate weighted relative performance per player
            const result: Record<string, number> = {};

            for (const username of allPlayers) {
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

                    const playerAvg =
                        playerStats.totalDamage / playerStats.tokens;
                    const relativePerformance = playerAvg / guildAvg;
                    const weight = playerStats.tokens;

                    weightedSum += weight * relativePerformance;
                    totalWeight += weight;
                }

                result[username] =
                    totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;
            }

            return result;
        } catch (error) {
            logger.error(
                error,
                "Error calculating weighted relative performance",
            );
            return null;
        }
    }

    async fetchGuildMembers(discordId: string) {
        try {
            const guildId = await this.getGuildId(discordId);
            if (!guildId) {
                logger.error("No guild ID found for user:", discordId);
                return null;
            }

            const members = await fetchGuildMembers(guildId);
            if (!members) {
                logger.error("No members found for guild ID:", guildId);
                return null;
            }

            return members;
        } catch (error) {
            logger.error(error, "Error fetching LOKI guild members: ");
            return null;
        }
    }
}
