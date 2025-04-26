import { HominaTacticusClient } from "@/client";
import { dbController } from "@/lib";
import type { GuildRaidResult, Raid } from "@/models/types";
import { getPlayerName } from "../../../player-mapping";
import { DamageType, Rarity } from "@/models/enums";

export class GuildService {
    private client: HominaTacticusClient;

    constructor() {
        this.client = new HominaTacticusClient();
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
            console.error("Error fetching guild seasons: ", error);
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

        entries.forEach((entry) => {
            // Bombs don't count as damage
            if (!entry.userId || entry.damageType === DamageType.BOMB) {
                return;
            }
            const username = getPlayerName(entry.userId);
            if (!username) {
                throw new Error(
                    "Player name missing in the mapping " + entry.userId
                );
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
        });

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

        entries.forEach((entry) => {
            // Bombs don't count as damage
            if (!entry.userId || entry.damageType === DamageType.BOMB) {
                return;
            }

            const boss = entry.type;

            // Ensure groupedResults[boss] is initialized
            if (!groupedResults[boss]) {
                groupedResults[boss] = [];
            }

            const username = getPlayerName(entry.userId);
            if (!username) {
                throw new Error(
                    "Player name missing in the mapping " + entry.userId
                );
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
        });

        return groupedResults;
    }
}
