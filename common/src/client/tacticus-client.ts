import type { Guild } from "@/models/types/Guild";

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

        const result: GuildApiResponse = {
            guild: body as Guild,
            success: response.ok,
        };

        if (!response.ok) {
            result.message = response.statusText;
        }

        return result;
    }
}

export default HominaTacticusClient;
