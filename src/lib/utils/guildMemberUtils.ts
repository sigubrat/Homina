import type { HominaTacticusClient } from "@/client";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import type { DatabaseController } from "@/lib";
import { BotError } from "@/models/errors/BotError";
import { DatabaseError, ExternalApiError } from "@/models/errors/ServiceError";
import { NotRegisteredError } from "@/models/errors/UserError";
import type { MiddlewareMember } from "@/models/types";

/**
 * Resolves the guild ID for a user, falling back to an API lookup if not cached.
 * Throws NotRegisteredError if the user has no token, DatabaseError on DB failures,
 * and ExternalApiError on API failures.
 */
export async function resolveGuildId(
    discordId: string,
    client: HominaTacticusClient,
    db: DatabaseController,
): Promise<string> {
    let cachedGuildId: string | null;
    try {
        cachedGuildId = await db.getGuildIdByUserId(discordId);
    } catch (error) {
        if (error instanceof BotError) throw error;
        throw new DatabaseError("Failed to look up cached guild ID", {
            cause: error,
            context: { discordId },
        });
    }
    if (cachedGuildId) return cachedGuildId;

    let apiKey: string | null;
    try {
        apiKey = await db.getUserToken(discordId);
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
        resp = await client.getGuild(apiKey);
    } catch (error) {
        if (error instanceof BotError) throw error;
        throw new ExternalApiError("Failed to fetch guild from Tacticus API", {
            cause: error,
            context: { discordId },
        });
    }
    if (!resp.success || !resp.guild) {
        throw new ExternalApiError("Guild fetch returned unsuccessful response", {
            context: { discordId },
        });
    }

    const guildId = resp.guild.guildId;
    try {
        await db.updateGuildId(discordId, guildId);
    } catch (error) {
        if (error instanceof BotError) throw error;
        throw new DatabaseError("Failed to cache guild ID", {
            cause: error,
            context: { discordId, guildId },
        });
    }
    return guildId;
}

/**
 * Resolves guild members for a user, including nickname metadata overrides.
 * Falls back to API lookup if guild ID is not cached.
 * Throws typed errors on failures; returns an empty array for legitimately empty guilds.
 */
export async function resolveGuildMembers(
    discordId: string,
    client: HominaTacticusClient,
    db: DatabaseController,
): Promise<MiddlewareMember[]> {
    const guildId = await resolveGuildId(discordId, client, db);

    const members = await fetchGuildMembers(guildId);

    if (members.length > 0) {
        let metadata: Awaited<ReturnType<typeof db.getAllPlayerMetadataByGuild>>;
        try {
            metadata = await db.getAllPlayerMetadataByGuild(guildId);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to fetch player metadata", {
                cause: error,
                context: { guildId },
            });
        }

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
    }

    return members;
}
