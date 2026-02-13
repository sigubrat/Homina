/**
 * Middleware API client - delegates to HominaMiddleware service.
 * The actual implementation is hidden in the middleware.
 */

import type { MiddlewareMember } from "@/models/types";
import { logger } from "@/lib";

const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL ?? "http://localhost:3001";
const MIDDLEWARE_TIMEOUT = 30000;

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
            logger.error(`Middleware request failed: ${response.status}`);
            return [];
        }

        const data = (await response.json()) as MiddlewareResponse;
        return data.success ? (data.members ?? []) : [];
    } catch (error) {
        clearTimeout(timeoutId);
        logger.error(error, "Failed to fetch guild members via middleware");
        return [];
    }
}
