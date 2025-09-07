import { mapTierToRarity } from "@/lib/utils";
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
        let currentTier = 5;
        let currentSet = 0;
        let currentType = "";
        let previousMythic = false;
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
                if (!previousMythic) console.log("Mythic found");
                raid.rarity = Rarity.MYTHIC;
                previousMythic = true;
                currentSet = 0;
                if (raid.tier >= 6) {
                    currentTier = raid.tier + 1;
                }
            }

            // Find the first legendary boss after a mythic boss
            else if (
                previousMythic &&
                (raid.maxHp < 20e6 ||
                    (raid.encounterIndex > 0 && raid.maxHp < 1.9e6))
            ) {
                console.log("First legendary found");
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
                console.log("Other legendary found");
                currentSet = raid.set;
            }

            const prevType = currentType;
            currentType = raid.type;
            raid.tier = currentTier;
            raid.set = currentSet;

            if (prevType !== currentType) {
                console.log(
                    `New: ${mapTierToRarity(raid.tier, raid.set, true)} ${
                        raid.type
                    } - ${raid.maxHp} - ${raid.tier} - ${raid.set}`
                );
            }
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
