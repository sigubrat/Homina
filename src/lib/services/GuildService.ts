import { HominaTacticusClient } from "@/client";
import { dbController, logger } from "@/lib";
import type {
    GuildRaidAvailable,
    GuildRaidResult,
    Raid,
    TokenStatus,
    TokensAndBombs,
} from "@/models/types";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { TeamDistribution } from "@/models/types/TeamDistribution";
import {
    evaluateToken,
    getUnixTimestamp,
    hasLynchpinHero,
    inTeamsCheck,
    SecondsToString,
} from "../utils";
import type { GuildMemberMapping } from "@/models/types/GuildMemberMapping";

export class GuildService {
    private client: HominaTacticusClient;
    private metaTeamThreshold = 3; // Minimum number of meta heroes to be considered a meta team

    constructor() {
        this.client = new HominaTacticusClient();
    }

    /**
     * Fetches the guild ID for a given user ID.
     * @param discordId The ID of the user to fetch the guild ID for.
     * @returns The guild ID or null if not found or an error occurred.
     */
    async getGuildId(discordId: string): Promise<string | null> {
        try {
            const apiKey = await dbController.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                return null;
            }

            return resp.guild.guildId;
        } catch (error) {
            logger.error(error, "Error fetching guild ID");
            return null;
        }
    }

    /**
     * Fetches the members of a guild for a given user ID.
     * @param userId The ID of the user to fetch guild members for.
     * @returns A list of user IDs of the guild members or null if an error occurred.
     */
    async getGuildMembers(userId: string): Promise<string[] | null> {
        try {
            const apiKey = await dbController.getUserToken(userId);
            if (!apiKey) {
                throw new Error("API key not found for user: " + userId);
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                throw new Error("Failed to fetch guild for user: " + userId);
            }

            return resp.guild.members.map((member) => member.userId);
        } catch (error) {
            logger.error(error, "Error fetching guild members");
            return null;
        }
    }

    /**
     * Fetches the username of a player by their user ID.
     * @param userId The ID of the user to fetch the username for.
     * @returns The username of the user or null if not found.
     */
    async getUsernameById(userId: string): Promise<string | null> {
        try {
            const username = await dbController.getPlayerName(userId);
            if (!username) {
                return null;
            }

            return username;
        } catch (error) {
            logger.error(error, "Error fetching username by ID");
            return null;
        }
    }

    /**
     * Sets the player token for a given user ID and guild ID.
     * @param userId The ID of the user to set the token for.
     * @param token The token to set for the user.
     * @param guildId The ID of the guild to set the token for.
     * @returns True if the token was set successfully, false otherwise.
     */
    async setPlayerToken(
        userId: string,
        token: string,
        guildId: string
    ): Promise<boolean> {
        try {
            const result = await dbController.setPlayerToken(
                userId,
                token,
                guildId
            );
            return result;
        } catch (error) {
            logger.error(
                error,
                `Error setting player token for user: ${userId}`
            );
            return false;
        }
    }

    /**
     * Fetches the player token for a given user ID and guild ID.
     * @param userId The ID of the user to fetch the token for.
     * @param guildId The ID of the guild to fetch the token for.
     * @returns The player token or null if not found or an error occurred.
     */
    async getPlayerToken(
        userId: string,
        guildId: string
    ): Promise<string | null> {
        try {
            const token = await dbController.getPlayerToken(userId, guildId);
            if (!token) {
                return null;
            }
            return token;
        } catch (error) {
            logger.error(
                error,
                `Error fetching player token for user: ${userId}`
            );
            return null;
        }
    }

    /**
     * Fetches the player list for a given guild ID.
     * @param guildId The ID of the guild to fetch members for.
     * @returns A list of GuildMemberMapping objects or null if an error occurred.
     */
    async getPlayerList(guildId: string): Promise<GuildMemberMapping[] | null> {
        try {
            const members = await dbController.getGuildMembersByGuildId(
                guildId
            );
            if (!members) {
                return null;
            }

            return members;
        } catch (error) {
            logger.error(error, "Error fetching player list");
            return null;
        }
    }

    /**
     * Updates the guild members in the database.
     * If a member is no longer in the guild, they will be deleted.
     * If a member is new or has changed their username, they will be updated.
     * @param guildId The ID of the guild to update members for.
     * @param members The list of members to update.
     * @returns The number of updated members, or -1 if an error occurred.
     */
    async updateGuildMembers(
        guildId: string,
        members: GuildMemberMapping[]
    ): Promise<number> {
        // Now just call the transactional method in dbController
        return dbController.updateGuildMembersTransactional(guildId, members);
    }

    async updateGuildMember(
        tacticusId: string,
        newUsername: string,
        guildId: string,
        apiToken?: string
    ) {
        try {
            const result = await dbController.updatePlayerName(
                tacticusId,
                newUsername,
                guildId,
                apiToken
            );

            return result;
        } catch (error) {
            logger.error(error, `Error updating guild member: ${tacticusId}`);
            return false;
        }
    }

    /**
     * Deletes a guild member by their Tacticus ID.
     * @param tacticusId The Tacticus ID of the member to delete.
     * @param guildId The ID of the guild to delete the member from.
     * @returns True if the member was deleted, false otherwise.
     */
    async deleteGuildMemberById(
        tacticusId: string,
        guildId: string
    ): Promise<boolean> {
        try {
            const result = await dbController.deletePlayerNameById(
                tacticusId,
                guildId
            );
            return result > 0;
        } catch (error) {
            logger.error(error, `Error deleting guild member: ${tacticusId}`);
            return false;
        }
    }

    /**
     * Deletes a guild member by their username.
     * @param username The username of the member to delete.
     * @param guildId The ID of the guild to delete the member from.
     * @returns True if the member was deleted, false otherwise.
     */
    async deleteGuildMemberByUsername(
        username: string,
        guildId: string
    ): Promise<boolean> {
        try {
            const result = await dbController.deletePlayerNameByUsername(
                username,
                guildId
            );

            return result > 0;
        } catch (error) {
            logger.error(error, `Error deleting guild member: ${username}`);
            return false;
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
     * @param userId The ID of the user to fetch guild raid results for.
     * @param season The season to fetch results for.
     * @param rarity Optional rarity filter for the raid results.
     * @param includePrimes Whether to include prime encounters in the results.
     * @returns A list of GuildRaidResult objects or null if an error occurred.
     */
    async getGuildRaidResultBySeason(
        userId: string,
        season: number,
        rarity?: Rarity,
        includePrimes: boolean = true
    ): Promise<GuildRaidResult[] | null> {
        const apiKey = await dbController.getUserToken(userId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            entries = entries.filter((entry) => entry.rarity === rarity);
        }

        const damagePeruser: GuildRaidResult[] = [];

        for (const entry of entries) {
            // Bombs don't count as damage
            if (!entry.userId) {
                continue;
            }

            if (
                !includePrimes &&
                entry.encounterType === EncounterType.SIDE_BOSS
            ) {
                continue;
            }

            let username = await dbController.getPlayerName(entry.userId);
            if (!username) {
                username = "Unknown";
            }
            const existingEntry = damagePeruser.find(
                (e) => e.username === username
            );

            if (existingEntry) {
                if (entry.damageType === DamageType.BOMB) {
                    existingEntry.bombCount++;
                    continue; // Bombs don't count as damage
                }
                existingEntry.totalDamage += entry.damageDealt;
                existingEntry.totalTokens += 1;
                existingEntry.maxDmg = Math.max(
                    existingEntry.maxDmg ?? 0,
                    entry.damageDealt
                );
                existingEntry.minDmg = Math.min(
                    existingEntry.minDmg ?? entry.damageDealt,
                    entry.damageDealt
                );
            } else {
                if (entry.damageType === DamageType.BOMB) {
                    damagePeruser.push({
                        username: username,
                        totalDamage: 0,
                        totalTokens: 0,
                        boss: entry.type,
                        set: entry.set,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: 0,
                        maxDmg: 0,
                        bombCount: 1,
                    });
                } else {
                    damagePeruser.push({
                        username: username,
                        totalDamage: entry.damageDealt,
                        totalTokens: 1,
                        boss: entry.type,
                        set: entry.set,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: entry.damageDealt,
                        maxDmg: entry.damageDealt,
                        bombCount: 0,
                    });
                }
            }
        }
        return damagePeruser;
    }

    /**
     * Fetches the guild raid results grouped by rarity and season for each boss.
     * @param userId The ID of the user to fetch guild raid results for.
     * @param season The season to fetch results for.
     * @param rarity Optional rarity filter for the raid results.
     * @returns A record of boss names to their respective GuildRaidResult arrays or null if an error occurred.
     */
    async getGuildRaidResultByRaritySeasonPerBoss(
        userId: string,
        season: number,
        rarity: Rarity
    ) {
        const apiKey = await dbController.getUserToken(userId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            entries = entries.filter((entry) => entry.rarity === rarity);
        }

        const groupedResults: Record<string, GuildRaidResult[]> = {};

        for (const entry of entries) {
            // Bombs don't count as damage
            if (!entry.userId) {
                continue;
            }

            const boss = entry.type;

            // Ensure groupedResults[boss] is initialized
            if (!groupedResults[boss]) {
                groupedResults[boss] = [];
            }

            let username = await dbController.getPlayerName(entry.userId);
            if (!username) {
                // If a user is not registered or left the guild, we set their username to "Unknown"
                username = "Unknown";
            }

            const existingUserEntry = groupedResults[boss].find(
                (e) => e.username === username
            );

            if (existingUserEntry) {
                if (entry.damageType === DamageType.BOMB) {
                    existingUserEntry.bombCount++;
                    continue; // Bombs don't count as damage
                }
                existingUserEntry.totalDamage += entry.damageDealt;
                existingUserEntry.totalTokens += 1;
                existingUserEntry.maxDmg = Math.max(
                    existingUserEntry.maxDmg ?? 0,
                    entry.damageDealt
                );
                existingUserEntry.minDmg = Math.min(
                    existingUserEntry.minDmg ?? entry.damageDealt,
                    entry.damageDealt
                );
            } else {
                if (entry.damageType === DamageType.BOMB) {
                    groupedResults[boss].push({
                        bombCount: 1,
                        username: username,
                        totalDamage: 0,
                        totalTokens: 0,
                        boss: entry.type,
                        set: entry.set,
                        tier: entry.tier,
                        startedOn: entry.startedOn,
                        minDmg: 0,
                        maxDmg: 0,
                    });
                } else {
                    groupedResults[boss].push({
                        bombCount: 0,
                        username: username,
                        totalDamage: entry.damageDealt,
                        totalTokens: 1,
                        boss: entry.type,
                        set: entry.set,
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
        userId: string,
        season: number,
        rarity?: Rarity
    ): Promise<Record<string, number> | null> {
        const apiKey = await dbController.getUserToken(userId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        let entries: Raid[] = resp.entries;

        if (rarity) {
            entries = entries.filter((entry) => entry.rarity === rarity);
        }

        const bombs: Raid[] = entries.filter(
            (entry) => entry.damageType === DamageType.BOMB
        );

        const bombsPerUser: Record<string, number> = {};
        for (const bomb of bombs) {
            let username = await dbController.getPlayerName(bomb.userId);
            if (!username) {
                username = "Unknown";
            }

            bombsPerUser[username] = (bombsPerUser[username] ?? 0) + 1;
        }

        return bombsPerUser;
    }

    /**
     * Fetches the meta team distribution for a given user ID and season.
     * @param userId The ID of the user to fetch meta team distribution for.
     * @param season The season to fetch results for.
     * @param tier Optional rarity filter for the raid results.
     * @returns A TeamDistribution object or null if an error occurred.
     */
    async getMetaTeamDistribution(
        userId: string,
        season: number,
        tier?: Rarity
    ) {
        /**
         * There are 3 meta teams in tacticus at the moment:
         * 1. Multi-hit team (Ragnar, Eldryon, Kharn, Aunshi, Snotflogga, Calgar and Big Boss Gulgortz)
         * 2. Psyker team (Neurothrope, Yazakhor, Abraxas, Ahrimann, Eldryon, Roswitha, Mephiston),
         * 3. Mech team (Exitor Rho, Tan Gida, Actus, Sho'syl, Vitruvius, Big Boss Gulgortz, Aneph Null)
         *
         * For each entry in the data, we need to figure out which team it most likely is by checking if they have a majority of the meta team members.
         */
        try {
            const apiKey = await dbController.getUserToken(userId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            let entries: Raid[] = resp.entries;

            if (tier) {
                entries = entries.filter((entry) => entry.rarity === tier);
            }

            const totalDistribution: TeamDistribution = {
                mech: 0,
                multihit: 0,
                psyker: 0,
                mechDamage: 0,
                multihitDamage: 0,
                psykerDamage: 0,
                other: 0,
                otherDamage: 0,
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

                const distribution: TeamDistribution = {
                    multihit: 0,
                    mech: 0,
                    psyker: 0,
                    other: 0,
                };

                for (const hero of heroes) {
                    const check = inTeamsCheck(hero);
                    distribution.mech += check.inMech ? 1 : 0;
                    distribution.multihit += check.inMulti ? 1 : 0;
                    distribution.psyker += check.inPsyker ? 1 : 0;
                }

                // find which property of distrubution has the highest value
                const values = [
                    distribution.mech,
                    distribution.multihit,
                    distribution.psyker,
                ];

                // Check that at least one of the values is 3 or more, or else we count it as non-meta (other)
                if (
                    distribution.mech < this.metaTeamThreshold &&
                    distribution.multihit < this.metaTeamThreshold &&
                    distribution.psyker < this.metaTeamThreshold
                ) {
                    totalDistribution.other += 1;
                    totalDistribution.otherDamage =
                        (totalDistribution.otherDamage || 0) +
                        entry.damageDealt;
                    continue;
                }

                const maxValue = Math.max(...values);
                const maxIndex = values.indexOf(maxValue);
                const teams = ["mech", "multihit", "psyker"];
                const team = teams[maxIndex];

                if (!team) {
                    throw new Error("teams[maxIndex] is somehow undefined");
                }

                if (!hasLynchpinHero(heroes, team)) {
                    totalDistribution.other += 1;
                    totalDistribution.otherDamage =
                        (totalDistribution.otherDamage || 0) +
                        entry.damageDealt;
                    continue;
                }

                if (team === "mech") {
                    // Check if the team has a lynchpin hero
                    totalDistribution.mech = (totalDistribution.mech || 0) + 1;
                    totalDistribution.mechDamage =
                        (totalDistribution.mechDamage || 0) + entry.damageDealt;
                } else if (team === "multihit") {
                    totalDistribution.multihit =
                        (totalDistribution.multihit || 0) + 1;
                    totalDistribution.multihitDamage =
                        (totalDistribution.multihitDamage || 0) +
                        entry.damageDealt;
                } else if (team === "psyker") {
                    totalDistribution.psyker =
                        (totalDistribution.psyker || 0) + 1;
                    totalDistribution.psykerDamage =
                        (totalDistribution.psykerDamage || 0) +
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
     * @param userId The ID of the user to fetch meta team distribution for.
     * @param season The season to fetch results for.
     * @param tier Optional rarity filter for the raid results.
     * @returns A record of usernames to their respective TeamDistribution objects or null if an error occurred.
     */
    async getMetaTeamDistributionPerPlayer(
        userId: string,
        season: number,
        tier?: Rarity
    ) {
        try {
            const apiKey = await dbController.getUserToken(userId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            let entries: Raid[] = resp.entries;

            if (tier) {
                entries = entries.filter((entry) => entry.rarity === tier);
            }

            const groupedResults: Record<string, Raid[]> = {};
            for (const entry of entries) {
                const userID = entry.userId;
                // bombs and sideboss don't count as damage
                if (
                    !entry.userId ||
                    entry.damageType === DamageType.BOMB ||
                    entry.encounterType === EncounterType.SIDE_BOSS
                ) {
                    continue;
                }

                // Ensure groupedResults[username] is initialized
                if (!groupedResults[userID]) {
                    groupedResults[userID] = [];
                }

                groupedResults[userID].push(entry);
            }

            const result: Record<string, TeamDistribution> = {};
            for (const key in groupedResults) {
                // Replace ID with username
                const entries = groupedResults[key];
                const username = await dbController.getPlayerName(key);
                if (!username || !entries) {
                    continue;
                }

                const totalDistribution: TeamDistribution = {
                    mech: 0,
                    multihit: 0,
                    psyker: 0,
                    mechDamage: 0,
                    multihitDamage: 0,
                    psykerDamage: 0,
                    other: 0,
                    otherDamage: 0,
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

                    const distribution: TeamDistribution = {
                        multihit: 0,
                        mech: 0,
                        psyker: 0,
                        other: 0,
                    };

                    for (const hero of heroes) {
                        const check = inTeamsCheck(hero);
                        distribution.mech += check.inMech ? 1 : 0;
                        distribution.multihit += check.inMulti ? 1 : 0;
                        distribution.psyker += check.inPsyker ? 1 : 0;
                    }

                    // find which property of distrubution has the highest value
                    const values = [
                        distribution.mech,
                        distribution.multihit,
                        distribution.psyker,
                    ];

                    // Check that at least one of the values is 3 or more, or else we count it as non-meta (other)
                    if (
                        distribution.mech < this.metaTeamThreshold &&
                        distribution.multihit < this.metaTeamThreshold &&
                        distribution.psyker < this.metaTeamThreshold
                    ) {
                        totalDistribution.other += 1;
                        totalDistribution.otherDamage =
                            (totalDistribution.otherDamage || 0) +
                            entry.damageDealt;
                        continue;
                    }

                    const maxValue = Math.max(...values);
                    const maxIndex = values.indexOf(maxValue);
                    const teams = ["mech", "multihit", "psyker"];
                    const team = teams[maxIndex];

                    if (!team) {
                        throw new Error("teams[maxIndex] is somehow undefined");
                    }

                    if (!hasLynchpinHero(heroes, team)) {
                        totalDistribution.other += 1;
                        totalDistribution.otherDamage =
                            (totalDistribution.otherDamage || 0) +
                            entry.damageDealt;
                        continue;
                    }

                    if (team === "mech") {
                        // Check if the team has a lynchpin hero
                        totalDistribution.mech =
                            (totalDistribution.mech || 0) + 1;
                        totalDistribution.mechDamage =
                            (totalDistribution.mechDamage || 0) +
                            entry.damageDealt;
                    } else if (team === "multihit") {
                        totalDistribution.multihit =
                            (totalDistribution.multihit || 0) + 1;
                        totalDistribution.multihitDamage =
                            (totalDistribution.multihitDamage || 0) +
                            entry.damageDealt;
                    } else if (team === "psyker") {
                        totalDistribution.psyker =
                            (totalDistribution.psyker || 0) + 1;
                        totalDistribution.psykerDamage =
                            (totalDistribution.psykerDamage || 0) +
                            entry.damageDealt;
                    }
                }

                // Calculate percentages
                const totalEntries = entries.length;
                const totalDamage =
                    totalDistribution.mechDamage! +
                    totalDistribution.multihitDamage! +
                    totalDistribution.psykerDamage! +
                    totalDistribution.otherDamage!;

                if (totalDamage === 0 || totalEntries === 0) {
                    result[username] = {
                        mech: 0,
                        multihit: 0,
                        psyker: 0,
                        other: 0,
                        mechDamage: 0,
                        multihitDamage: 0,
                        psykerDamage: 0,
                        otherDamage: 0,
                    };
                    continue;
                }

                const percentages: TeamDistribution = {
                    mech: (totalDistribution.mech / totalEntries) * 100,
                    multihit: (totalDistribution.multihit / totalEntries) * 100,
                    psyker: (totalDistribution.psyker / totalEntries) * 100,
                    other: (totalDistribution.other / totalEntries) * 100,
                    mechDamage:
                        (totalDistribution.mechDamage! / totalDamage) * 100,
                    multihitDamage:
                        (totalDistribution.multihitDamage! / totalDamage) * 100,
                    psykerDamage:
                        (totalDistribution.psykerDamage! / totalDamage) * 100,
                    otherDamage:
                        (totalDistribution.otherDamage! / totalDamage) * 100,
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
     * @param userId The ID of the user to fetch available tokens and bombs for.
     * @returns A record of usernames to their respective GuildRaidAvailable objects or null if an error occurred.
     */
    async getAvailableTokensAndBombs(userId: string) {
        const tokenCooldownInSeconds = 12 * 60 * 60;
        const bombCooldownInSeconds = 18 * 60 * 60;
        const maxTokens = 3;
        const now = new Date();

        try {
            const apiKey = await dbController.getUserToken(userId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!resp || !resp.entries) {
                return null;
            }

            const prevSeason = await this.client.getGuildRaidBySeason(
                apiKey,
                resp.season - 1
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

            const guildId = await this.getGuildId(userId);
            if (!guildId) {
                return null;
            }

            const currentMembersArr = await this.getGuildMembers(userId);
            if (!currentMembersArr || currentMembersArr.length === 0) {
                return null;
            }

            const currentMembers = new Set(currentMembersArr);

            // Find out who have left the guild and therefore should not be included in the results
            const formerMembers = new Set(
                Array.from(prevUsers).filter(
                    (prevId) => !currentMembers.has(prevId)
                )
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
                        tokens: maxTokens,
                        bombs: 1,
                    };

                    const playerApiToken = await this.getPlayerToken(
                        userId,
                        guildId
                    );

                    // If there is a player API token, we can fetch the cooldowns and skip calculations
                    if (playerApiToken) {
                        const cd = await this.getPlayerCooldowns(
                            playerApiToken
                        );
                        if (cd) {
                            result[userId] = cd;
                            return;
                        }
                    }

                    const mostRecentBomb = data.bombs
                        .sort((a, b) => b.startedOn - a.startedOn)
                        .find(() => true);

                    if (mostRecentBomb) {
                        const diff =
                            getUnixTimestamp(now) - mostRecentBomb.startedOn;
                        const diffHours = Math.floor(diff / 3600);
                        if (diffHours < 18) {
                            temp.bombs = 0;
                            temp.bombCooldown = SecondsToString(
                                bombCooldownInSeconds - diff
                            );
                        } else {
                            temp.bombCooldown = SecondsToString(
                                diff - bombCooldownInSeconds,
                                true
                            );
                        }
                    }

                    const sortedTokensAsc = data.tokens.sort(
                        (a, b) => a.startedOn - b.startedOn
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
                    if (token.count < maxTokens) {
                        const tokenDiff =
                            getUnixTimestamp(now) - token.refreshTime;
                        temp.tokenCooldown = SecondsToString(
                            tokenCooldownInSeconds - tokenDiff
                        );
                    }
                    temp.tokens = token.count;
                    result[userId] = temp;
                })
            );

            // Replace user IDs with usernames
            const resultWithNames: Record<string, GuildRaidAvailable> = {};
            await Promise.all(
                Object.entries(result).map(async ([userId, available]) => {
                    const username = await dbController.getPlayerName(userId);
                    if (username) {
                        resultWithNames[username] = available;
                    }
                })
            );

            return resultWithNames;
        } catch (error) {
            logger.error(error, "Error fetching available tokens and bombs: ");
            return null;
        }
    }

    /**
     * Fetches the guild raid entries for a given user ID and season.
     * @param userId The ID of the user to fetch guild raid entries for.
     * @param season The season to fetch entries for.
     * @param rarity Optional rarity filter for the raid entries.
     * @returns A list of Raid objects or null if an error occurred.
     */
    async getGuildRaidBySeason(
        userId: string,
        season: number,
        rarity?: Rarity
    ) {
        const apiKey = await dbController.getUserToken(userId);
        if (!apiKey) {
            return null;
        }

        const resp = await this.client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        if (rarity) {
            resp.entries = resp.entries.filter(
                (entry) => entry.rarity === rarity
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
                          player.progress.guildRaid.tokens.nextTokenInSeconds
                      )
                    : undefined,
                bombCooldown: player.progress.guildRaid?.bombTokens
                    .nextTokenInSeconds
                    ? SecondsToString(
                          player.progress.guildRaid.bombTokens
                              .nextTokenInSeconds
                      )
                    : undefined,
            };

            return status;
        } catch (error) {
            logger.error(error, "Error fetching player cooldowns: ");
            return null;
        }
    }
}
