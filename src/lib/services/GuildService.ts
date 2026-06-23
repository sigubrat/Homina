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
            throw new ExternalApiError(
                "Guild fetch returned unsuccessful response",
                {
                    context: { discordId },
                },
            );
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
            throw new ExternalApiError(
                "Guild fetch returned unsuccessful response",
                {
                    context: { discordId },
                },
            );
        }
        return resp.guild.level;
    }
}
