import type { HominaTacticusClient } from "@/client";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import type { DatabaseController } from "@/lib";
import type { MiddlewareMember } from "@/models/types";

/**
 * Resolves the guild ID for a user, falling back to an API lookup if not cached.
 */
export async function resolveGuildId(
    discordId: string,
    client: HominaTacticusClient,
    db: DatabaseController,
): Promise<string | null> {
    const cachedGuildId = await db.getGuildIdByUserId(discordId);
    if (cachedGuildId) return cachedGuildId;

    const apiKey = await db.getUserToken(discordId);
    if (!apiKey) return null;

    const resp = await client.getGuild(apiKey);
    if (!resp.success || !resp.guild) return null;

    const guildId = resp.guild.guildId;
    await db.updateGuildId(discordId, guildId);
    return guildId;
}

/**
 * Resolves guild members for a user, including nickname metadata overrides.
 * Falls back to API lookup if guild ID is not cached.
 */
export async function resolveGuildMembers(
    discordId: string,
    client: HominaTacticusClient,
    db: DatabaseController,
): Promise<MiddlewareMember[] | null> {
    const guildId = await resolveGuildId(discordId, client, db);
    if (!guildId) return null;

    const members = await fetchGuildMembers(guildId);
    if (!members || members.length === 0) return null;

    const metadata = await db.getAllPlayerMetadataByGuild(guildId);
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
