import { Rarity } from "@/models/enums";
import type { Player, Raid } from "@/models/types";
import type { Guild } from "@/models/types/Guild";
import type { GuildRaidResponse } from "@/models/types/GuildRaidResponse";

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

    preProcessData(raids: Raid[]): Raid[] {
        let currentTier: number = 5;
        let currentSet: number = 0;
        let currentType: string = "";
        let previousMythic: boolean = false;

        // No need to process if the guild has not reached tier 5 raids yet
        const lastTier = raids.at(-1)?.tier;
        if (!lastTier || lastTier < 5) {
            return raids;
        }

        for (const raid of raids) {
            if (raid.tier < 5) {
                continue;
            }

            console.log(
                `${raid.type} - ${raid.maxHp} - ${raid.tier} - ${raid.set}`
            );

            // Find the mythic boss
            if (
                raid.maxHp > 20e6 ||
                (raid.encounterIndex > 0 && raid.maxHp > 1.9e6)
            ) {
                raid.rarity = Rarity.MYTHIC;
                if (!previousMythic && raid.tier >= 6) {
                    currentTier++;
                }
                previousMythic = true;
                currentSet = 0;
            }

            // Find the first legendary boss after a mythic boss
            else if (
                previousMythic &&
                (raid.maxHp < 20e6 ||
                    (raid.encounterIndex > 0 && raid.maxHp < 1.9e6))
            ) {
                previousMythic = false;
                currentTier++;
                currentSet = 0;
            }

            // Find other legendary bosses in the same tier
            else if (
                raid.type !== currentType &&
                (raid.maxHp < 20e6 ||
                    (raid.encounterIndex > 0 && raid.maxHp < 1.9e6))
            ) {
                currentSet = raid.set;
            }

            currentType = raid.type;
            raid.tier = currentTier;
            raid.set = currentSet;
        }

        return raids;
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

        body.entries = this.preProcessData(body.entries);

        return body;
    }

    async getGuildRaidByCurrentSeason(
        apiKey: string
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

            body.entries = this.preProcessData(body.entries);

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
