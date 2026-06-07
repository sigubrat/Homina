import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController } from "@/lib";
import { BotError } from "@/models/errors/BotError";
import { DatabaseError, ExternalApiError } from "@/models/errors/ServiceError";
import { NotRegisteredError } from "@/models/errors/UserError";
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

    async getGuildId(discordId: string): Promise<string> {
        try {
            return await resolveGuildId(discordId, this.client, this.db);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to resolve guild ID", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getGuildMembers(discordId: string): Promise<string[]> {
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

        let resp;
        try {
            resp = await this.client.getGuild(apiKey);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch guild members", {
                cause: error,
                context: { discordId },
            });
        }
        if (!resp.success || !resp.guild) {
            throw new ExternalApiError("Guild fetch returned unsuccessful response", {
                context: { discordId },
            });
        }

        return resp.guild.members.map((member) => member.userId);
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
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to test API token", {
                cause: error,
                context: { userId },
            });
        }
    }

    async fetchGuildMembers(discordId: string) {
        try {
            return await resolveGuildMembers(discordId, this.client, this.db);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch guild members", {
                cause: error,
                context: { discordId },
            });
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
        let apikey: string | null;
        try {
            apikey = await this.db.getUserToken(discordId);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to retrieve API token", {
                cause: error,
                context: { discordId },
            });
        }
        if (!apikey) throw new NotRegisteredError();

        let currentSeason;
        try {
            currentSeason = await this.client.getGuildRaidByCurrentSeason(apikey);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch current raid season", {
                cause: error,
                context: { discordId },
            });
        }
        if (!currentSeason || !currentSeason.season) {
            throw new ExternalApiError("No current season data returned", {
                context: { discordId },
            });
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

        try {
            const seasonPromises = seasons.map(
                async (season) =>
                    await this.client.getGuildRaidBySeason(apikey!, season),
            );
            const responses = await Promise.all(seasonPromises);

            return responses.map((resp) => ({
                config: Number(resp.seasonConfigId.at(-1)),
                season: resp.season,
            }));
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch season configs", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getSeasonsWithSameConfig(
        discordId: string,
        nSeasons: number,
        season: number,
    ) {
        let apikey: string | null;
        try {
            apikey = await this.db.getUserToken(discordId);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to retrieve API token", {
                cause: error,
                context: { discordId },
            });
        }
        if (!apikey) throw new NotRegisteredError();

        try {
            const desiredSeason = await this.client.getGuildRaidBySeason(
                apikey,
                season,
            );

            if (!desiredSeason || !desiredSeason.season) {
                throw new ExternalApiError("No season data returned", {
                    context: { discordId, season },
                });
            }

            const desiredConfig = desiredSeason.seasonConfigId;
            if (!desiredConfig) {
                throw new ExternalApiError("No season config found", {
                    context: { discordId, season },
                });
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
                async (s) =>
                    await this.client
                        .getGuildRaidBySeason(apikey!, s)
                        .catch(() => null),
            );

            const responses = await Promise.all(seasonPromises);

            return responses
                .filter(
                    (resp) =>
                        resp &&
                        resp.seasonConfigId.at(-1) === desiredConfig.at(-1),
                )
                .map((resp) => resp!.season);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError(
                `Failed to fetch seasons with same config as season ${season}`,
                { cause: error, context: { discordId, season } },
            );
        }
    }

    async getGuildLevel(discordId: string): Promise<number> {
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

        let resp;
        try {
            resp = await this.client.getGuild(apiKey);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch guild level", {
                cause: error,
                context: { discordId },
            });
        }
        if (!resp.success || !resp.guild) {
            throw new ExternalApiError("Guild fetch returned unsuccessful response", {
                context: { discordId },
            });
        }
        return resp.guild.level;
    }
}
