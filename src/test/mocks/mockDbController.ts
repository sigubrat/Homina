/**
 * Creates a mock DatabaseController for testing services.
 * Pass overrides for methods you need to control.
 */
export function createMockDb(
    overrides: {
        getUserToken?: (discordId: string) => Promise<string | null>;
        getGuildIdByUserId?: (discordId: string) => Promise<string | null>;
        updateGuildId?: (discordId: string, guildId: string) => Promise<void>;
        getAllPlayerMetadataByGuild?: (
            guildId: string,
        ) => Promise<
            { userId: string; nickname?: string; playerToken?: string }[]
        >;
        registerUser?: (
            userId: string,
            apiToken: string,
            guildId: string,
            inviterId: string,
        ) => Promise<boolean>;
    } = {},
) {
    return {
        getUserToken: overrides.getUserToken ?? (async () => "mock-api-key"),
        getGuildIdByUserId:
            overrides.getGuildIdByUserId ?? (async () => "guild-1"),
        updateGuildId: overrides.updateGuildId ?? (async () => {}),
        getAllPlayerMetadataByGuild:
            overrides.getAllPlayerMetadataByGuild ?? (async () => []),
        registerUser: overrides.registerUser ?? (async () => true),
    } as any;
}
