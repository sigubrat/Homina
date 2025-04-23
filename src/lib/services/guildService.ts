import { HominaTacticusClient } from "@/client";
import { dbController } from "@/lib";
import type { Raid } from "@/models/types";
import { getPlayerName } from "../../../player-mapping";
import { DamageType } from "@/models/enums";

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

            const client = new HominaTacticusClient();

            const resp = await client.getGuild(apiKey);

            console.log("GuildService.getGuildSeasons - resp:", resp);

            if (!resp.success || !resp.guild) {
                return null;
            }

            return resp.guild.guildRaidSeasons;
        } catch (error) {
            console.error("Error fetching guild seasons: ", error);
            return null;
        }
    }

    async getTokensBySeason(
        userId: string,
        season: number
    ): Promise<Record<string, number> | null> {
        const apiKey = await dbController.getUserToken(userId);
        if (!apiKey) {
            return null;
        }

        const client = new HominaTacticusClient();

        const resp = await client.getGuildRaidBySeason(apiKey, season);
        if (!resp || !resp.entries) {
            return null;
        }

        const entries: Raid[] = resp.entries;

        const tokens: Record<string, number> = {};

        entries.forEach((entry) => {
            // Bombs don't count as tokens used
            if (!entry.userId || entry.damageType === DamageType.BOMB) {
                return;
            }
            const username = getPlayerName(entry.userId);
            if (!username) {
                throw new Error(
                    "Player name missing in the mapping " + entry.userId
                );
            }
            tokens[username] = (tokens[username] ?? 0) + 1;
        });

        return tokens;
    }
}
