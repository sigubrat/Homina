import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController, logger } from "@/lib";
import { testApiToken } from "../utils/commandUtils";
import {
    resolveGuildId,
    resolveGuildMembers,
} from "@/lib/utils/guildMemberUtils";

/**
 * Service class for managing guild-related operations.
 *
 * Core responsibilities: guild identity, member resolution, token validation,
 * and season config lookups.
 */
export class GuildService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    // ─── Core guild methods ─────────────────────────────────────────────

    async getGuildId(discordId: string): Promise<string | null> {
        try {
            return await resolveGuildId(discordId, this.client, this.db);
        } catch (error) {
            logger.error(error, "Error fetching guild ID");
            return null;
        }
    }

    async getGuildMembers(discordId: string): Promise<string[] | null> {
        try {
            const apiKey = await this.db.getUserToken(discordId);
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

    async testRegisteredGuildApiToken(
        userId: string,
    ): Promise<{ status: boolean; message: string }> {
        try {
            const apiToken = await this.db.getUserToken(userId);
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

    async fetchGuildMembers(discordId: string) {
        try {
            const members = await resolveGuildMembers(
                discordId,
                this.client,
                this.db,
            );
            if (!members) {
                logger.error("No members found for user:", discordId);
                return null;
            }
            return members;
        } catch (error) {
            logger.error(error, "Error fetching LOKI guild members: ");
            return null;
        }
    }

    async verifySameGuild(
        discordId: string,
        targetGuildId: string,
    ): Promise<boolean> {
        const callerGuildId = await this.getGuildId(discordId);
        return callerGuildId === targetGuildId;
    }

    async getNLastSeasonConfigs(discordId: string, nSeasons: number) {
        const apikey = await this.db.getUserToken(discordId);
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

    async getSeasonsWithSameConfig(
        discordId: string,
        nSeasons: number,
        season: number,
    ) {
        const apikey = await this.db.getUserToken(discordId);
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

    async getGuildLevel(discordId: string): Promise<number | null> {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                logger.error("No API key found for user:", discordId);
                return null;
            }
            const resp = await this.client.getGuild(apiKey);
            if (!resp.success || !resp.guild) {
                logger.error("Failed to fetch guild for user:", discordId);
                return null;
            }
            return resp.guild.level;
        } catch (error) {
            logger.error(error, "Error fetching guild level");
            return null;
        }
    }
}
