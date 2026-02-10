import type { Player, Raid } from "@/models/types";
import type { Guild } from "@/models/types/Guild";
import type { GuildRaidResponse } from "@/models/types/GuildRaidResponse";
import { fetchGuildMembers } from "./MiddlewareClient";

export interface GuildApiResponse {
    success: boolean;
    message?: string;
    guild?: Guild;
}

export interface PlayerApiResponse {
    success: boolean;
    message?: string;
    player?: Player;
}

class HominaTacticusClient {
    private baseUrl: string = "https://api.tacticusgame.com/api/v1";

    /**
     * Replaces userIds in raid entries with display names from the Middleware API.
     */
    async replaceIdsWithUsernames(
        raids: Raid[],
        guildId: string,
    ): Promise<Raid[]> {
        const guildMembers = await fetchGuildMembers(guildId);

        if (!guildMembers || guildMembers.length === 0) {
            return raids;
        }

        // Create a map of userId -> displayName for quick lookup
        const idToDisplayName = new Map<string, string>();
        for (const member of guildMembers) {
            idToDisplayName.set(member.userId, member.displayName);
        }

        // Track unknown users to assign consistent labels
        const unknownUserMap = new Map<string, string>();
        let unknownCounter = 1;

        // Replace userIds with displayNames
        return raids.map((raid) => {
            const displayName = idToDisplayName.get(raid.userId);
            if (displayName) {
                return { ...raid, userId: displayName };
            } else {
                // Assign a consistent label to each unique unknown userId
                if (!unknownUserMap.has(raid.userId)) {
                    unknownUserMap.set(
                        raid.userId,
                        `Unknown ${unknownCounter++}`,
                    );
                }
                return { ...raid, userId: unknownUserMap.get(raid.userId)! };
            }
        });
    }

    async getGuild(apiKey: string): Promise<GuildApiResponse> {
        const response = await fetch(`${this.baseUrl}/guild`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-API-KEY": `${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`GET request failed: ${response.statusText}`);
        }

        const body = await response.json();

        let result: GuildApiResponse;

        if (isGuildResponse(body)) {
            result = {
                guild: body.guild as Guild,
                success: response.ok,
            };
        } else {
            result = {
                guild: undefined,
                success: false,
            };
        }

        if (!response.ok) {
            result.message = response.statusText;
        }

        return result;
    }

    async getPlayer(apiToken: string) {
        const response = await fetch(`${this.baseUrl}/player`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-API-KEY": `${apiToken}`,
            },
        });
        if (!response.ok) {
            throw new Error(`GET request failed: ${response.statusText}`);
        }
        const body = await response.json();

        let result: PlayerApiResponse;

        if (isPlayerResponse(body)) {
            result = {
                player: body.player as Player,
                success: response.ok,
            };
        } else {
            result = {
                player: undefined,
                success: false,
            };
        }

        if (!response.ok) {
            result.message = response.statusText;
        }

        return result;
    }

    async getGuildRaidBySeason(
        apiKey: string,
        season: number,
    ): Promise<GuildRaidResponse> {
        const response = await fetch(`${this.baseUrl}/guildRaid/${season}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-API-KEY": `${apiKey}`,
            },
        });

        if (!response.ok) {
            throw new Error(`GET request failed: ${response.statusText}`);
        }

        const body = (await response.json()) as GuildRaidResponse;

        return body;
    }

    async getGuildRaidByCurrentSeason(
        apiKey: string,
    ): Promise<GuildRaidResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/guildRaid`, {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    "X-API-KEY": `${apiKey}`,
                },
            });

            if (!response.ok) {
                throw new Error(`GET request failed: ${response.status}`);
            }

            const body = (await response.json()) as GuildRaidResponse;

            return body;
        } catch (error) {
            throw new Error(`GET request failed: ${error}`);
        }
    }
}

// Typeguards because TS shenanigans
function isGuildResponse(body: unknown): body is { guild: Guild } {
    return (
        typeof body === "object" &&
        body !== null &&
        "guild" in body &&
        typeof (body as any).guild === "object"
    );
}

function isPlayerResponse(body: unknown): body is { player: Player } {
    return (
        typeof body === "object" &&
        body !== null &&
        "player" in body &&
        typeof (body as any).player === "object"
    );
}

export default HominaTacticusClient;
