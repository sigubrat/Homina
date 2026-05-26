import type { GuildRaidResponse } from "@/models/types/GuildRaidResponse";
import type {
    GuildApiResponse,
    PlayerApiResponse,
} from "@/client/HominaTacticusClient";

/**
 * Creates a mock HominaTacticusClient for testing services.
 * Pass overrides for methods you need to control.
 */
export function createMockClient(
    overrides: {
        getGuildRaidBySeason?: (
            apiKey: string,
            season: number,
        ) => Promise<GuildRaidResponse>;
        getGuildRaidByCurrentSeason?: (
            apiKey: string,
        ) => Promise<GuildRaidResponse>;
        getGuild?: (apiKey: string) => Promise<GuildApiResponse>;
        getPlayer?: (apiToken: string) => Promise<PlayerApiResponse>;
    } = {},
) {
    return {
        getGuildRaidBySeason:
            overrides.getGuildRaidBySeason ??
            (async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: [],
            })),
        getGuildRaidByCurrentSeason:
            overrides.getGuildRaidByCurrentSeason ??
            (async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: [],
            })),
        getGuild:
            overrides.getGuild ??
            (async () => ({
                success: true,
                guild: { guildId: "guild-1", members: [] },
            })),
        getPlayer:
            overrides.getPlayer ??
            (async () => ({ success: true, player: undefined })),
    } as any;
}
