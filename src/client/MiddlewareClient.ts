/**
 * Middleware API client - delegates to HominaMiddleware service.
 * The actual implementation is hidden in the middleware.
 */

import type { MiddlewareMember } from "@/models/types";
import { ExternalApiError } from "@/models/errors/ServiceError";

const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL ?? "http://localhost:3001";
const MIDDLEWARE_TIMEOUT = 30000;

const GUILD_MEMBERS_CACHE_TTL = 60_000; // 1 minute
const GUILD_MEMBERS_STALE_TTL = 300_000; // 5 minutes - serve stale while refreshing
const guildMembersCache = new Map<
    string,
    { members: MiddlewareMember[]; expiresAt: number; staleAt: number }
>();

type MiddlewareResponse = {
    success: boolean;
    members?: MiddlewareMember[];
    error?: string;
};

/**
 * Fetches guild members via the middleware service.
 *
 * @param guildId - The guild ID to fetch members for
 * @returns Array of guild members with userId and displayName
 */
export async function fetchGuildMembers(
    guildId: string,
): Promise<MiddlewareMember[]> {
    const cached = guildMembersCache.get(guildId);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
        return cached.members;
    }

    // Stale-while-revalidate: return stale data immediately, refresh in background
    if (cached && cached.staleAt > now) {
        refreshGuildMembersCache(guildId);
        return cached.members;
    }

    return await refreshGuildMembersCache(guildId);
}

async function refreshGuildMembersCache(
    guildId: string,
): Promise<MiddlewareMember[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MIDDLEWARE_TIMEOUT);

    try {
        const response = await fetch(`${MIDDLEWARE_URL}/api/guild-members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guildId }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new ExternalApiError(
                "Middleware guild members request failed",
                {
                    context: { guildId, status: response.status },
                },
            );
        }

        const data = (await response.json()) as MiddlewareResponse;
        if (!data.success) {
            throw new ExternalApiError(
                "Middleware returned unsuccessful response",
                {
                    context: { guildId, error: data.error },
                },
            );
        }
        const members = data.members ?? [];
        guildMembersCache.set(guildId, {
            members,
            expiresAt: Date.now() + GUILD_MEMBERS_CACHE_TTL,
            staleAt: Date.now() + GUILD_MEMBERS_STALE_TTL,
        });
        return members;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof ExternalApiError) throw error;
        throw new ExternalApiError(
            "Failed to fetch guild members via middleware",
            {
                cause: error,
                context: { guildId },
            },
        );
    }
}
