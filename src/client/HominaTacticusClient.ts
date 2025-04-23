import type { Guild } from "@/models/types/Guild";
import type { GuildRaidResponse } from "@/models/types/GuildRaidResponse";

export interface GuildApiResponse {
    success: boolean;
    message?: string;
    guild?: Guild;
}

class HominaTacticusClient {
    private baseUrl: string = "https://api.tacticusgame.com/api/v1";

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

    async getGuildRaidBySeason(
        apiKey: string,
        season: number
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

export default HominaTacticusClient;
