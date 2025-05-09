import { HominaTacticusClient } from "@/client";
import { dbController, logger } from "@/lib";
import type {
    GuildRaidAvailable,
    GuildRaidResult,
    Raid,
    TokensAndBombs,
} from "@/models/types";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { TeamDistribution } from "@/models/types/TeamDistribution";
import { getUnixTimestamp, hasLynchpinHero, inTeamsCheck } from "../utils";
import type { GuildMemberMapping } from "@/models/types/GuildMemberMapping";

export class GuildService {
    private client: HominaTacticusClient;
    private metaTeamThreshold = 3; // Minimum number of meta heroes to be considered a meta team

    constructor() {
        this.client = new HominaTacticusClient();
    }

    async getGuildId(userId: string): Promise<string | null> {
        try {
            const apiKey = await dbController.getUserToken(userId);
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

    async getGuildMembers(userId: string): Promise<string[] | null> {
        try {
            const apiKey = await dbController.getUserToken(userId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                return null;
            }

            return resp.guild.members.map((member) => member.userId);
        } catch (error) {
            logger.error(error, "Error fetching guild members");
            return null;
        }
    }

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

    async updateGuildMembers(
        guildId: string,
        members: GuildMemberMapping[]
    ): Promise<number> {
        let updatedCount = 0;
        try {
            // Find out if any guild members are no longer in the guild and therefore need to be deleted
            const guildMembers = await dbController.getGuildMembersByGuildId(
                guildId
            );

            if (!guildMembers) {
                return -1;
            }

            const guildMemberIds = guildMembers.map((member) => member.userId);
            const membersToDelete = guildMemberIds.filter(
                (id) => !members.some((member) => member.userId === id)
            );

            for (const id of membersToDelete) {
                const result = await dbController.deletePlayerName(id, guildId);
                if (!result) {
                    continue;
                }
            }

            // Update the new guild members
            for (const member of members) {
                const result = await dbController.updatePlayerName(
                    member.userId,
                    member.username,
                    guildId
                );
                if (!result) {
                    continue;
                }

                updatedCount += 1;
            }

            return updatedCount;
        } catch (error) {
            logger.error(error, "Error updating guild members: ");
            return -1;
        }
    }

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

    async getGuildRaidResultBySeason(
        userId: string,
        season: number,
        tier?: Rarity
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

        if (tier) {
            entries = entries.filter((entry) => entry.rarity === tier);
        }

        const damagePeruser: GuildRaidResult[] = [];

        for (const entry of entries) {
            // Bombs don't count as damage
            if (!entry.userId || entry.damageType === DamageType.BOMB) {
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
                existingEntry.totalDamage += entry.damageDealt;
                existingEntry.totalTokens += 1;
            } else {
                damagePeruser.push({
                    username: username,
                    totalDamage: entry.damageDealt,
                    totalTokens: 1,
                    boss: entry.type,
                    set: entry.set,
                });
            }
        }
        return damagePeruser;
    }

    async getGuildRaidResultByTierSeasonPerBoss(
        userId: string,
        season: number,
        tier: Rarity
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

        if (tier) {
            entries = entries.filter((entry) => entry.rarity === tier);
        }

        const groupedResults: Record<string, GuildRaidResult[]> = {};

        for (const entry of entries) {
            // Bombs don't count as damage
            if (!entry.userId || entry.damageType === DamageType.BOMB) {
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
                existingUserEntry.totalDamage += entry.damageDealt;
                existingUserEntry.totalTokens += 1;
            } else {
                groupedResults[boss].push({
                    username: username,
                    totalDamage: entry.damageDealt,
                    totalTokens: 1,
                    boss: entry.type,
                    set: entry.set,
                });
            }
        }

        return groupedResults;
    }

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
                // bombs don't count as damage
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

    async getAvailableTokensAndBombs(userId: string) {
        const tokenCooldown = 12;
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

            const entries = resp.entries;
            if (!entries) {
                return null;
            }

            const users: Record<string, TokensAndBombs> = {};

            for (const entry of entries) {
                let username = await dbController.getPlayerName(entry.userId);
                if (!username) {
                    username = "Unknown";
                }

                if (!users[username]) {
                    users[username] = {
                        tokens: [],
                        bombs: [],
                    };
                }

                if (entry.damageType === DamageType.BOMB) {
                    users[username]?.bombs.push(entry);
                } else {
                    users[username]?.tokens.push(entry);
                }
            }

            // Find the most recent bomb used and up to 3 most recent tokens used
            const result: Record<string, GuildRaidAvailable> = {};

            Object.entries(users).forEach(([userId, data]) => {
                const temp: GuildRaidAvailable = {
                    tokens: maxTokens,
                    bombs: 0,
                };

                const mostRecentBomb = data.bombs
                    .sort((a, b) => {
                        return b.startedOn - a.startedOn;
                    })
                    .find(() => true);

                if (!mostRecentBomb) {
                    temp.bombs = 1;
                } else {
                    const diff =
                        getUnixTimestamp(now) - mostRecentBomb.startedOn;
                    const diffHours = diff / 3600;
                    if (diffHours > 18) temp.bombs = 1;
                }

                const sortedTokensDesc = data.tokens
                    .sort((a, b) => b.startedOn - a.startedOn)
                    .slice(0, maxTokens);

                let rechargedToken = 0;
                for (let i = 0; i < sortedTokensDesc.length; i++) {
                    const token = sortedTokensDesc[i];

                    if (!token) {
                        break;
                    }
                    const diffHours =
                        (getUnixTimestamp(now) - token.startedOn) / 3600;
                    const threshold = tokenCooldown * (i + 1);
                    if (diffHours < threshold) {
                        break;
                    } else {
                        rechargedToken += 1;
                    }
                }

                temp.tokens =
                    maxTokens - (sortedTokensDesc.length - rechargedToken);

                result[userId] = temp;
            });

            return result;
        } catch (error) {
            logger.error(error, "Error fetching available tokens and bombs: ");
            return null;
        }
    }
}
