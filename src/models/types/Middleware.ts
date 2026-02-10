/**
 * Type definitions for Middleware API player name mapping
 */

// ============================================================
// Middleware API Types
// ============================================================

export type MiddlewareMemberRecord = {
    userId?: string | null;
    playerId?: string | null;
    id?: string | null;
    displayName?: string | null;
    name?: string | null;
    playerName?: string | null;
    role?: string | null;
    guildRole?: string | null;
    memberRole?: string | null;
    hasDuplicateName?: boolean;
    originalDisplayName?: string | null;
};

export type MiddlewareApiResult<T = unknown> = {
    success: boolean;
    status?: number;
    error?: string;
    data?: T;
};

export type MiddlewareMember = {
    userId: string;
    displayName: string;
    role: "leader" | "officer" | "member" | string;
    hasDuplicateName?: boolean;
    originalDisplayName?: string | null;
};

export type MiddlewareGuildResponse = {
    eventResult?: {
        eventResponseData?: {
            guild?: {
                members?: MiddlewareMemberRecord[];
            };
        };
    };
};

// ============================================================
// Configuration Types
// ============================================================

export type MiddlewareCredentials = {
    guildId: string;
    userId: string;
    sessionId?: string | null;
};

export type ViewGuildPayload = {
    playerEvent: {
        playerEventType: "VIEW_GUILD_2";
        playerEventData: {
            guildId: string;
        };
    };
};

export type ConnectPayload = {
    playerEvent: {
        playerEventType: "CONNECT";
        playerEventData: {
            userId: string;
            clientSecret: string;
            deviceData: {
                buildString: string;
            };
        };
    };
};

export type DeviceData = {
    installId: string;
    deviceId: string;
    countryCode: string;
    locale: string;
    manufacturer: string;
    model: string;
    os: string;
    buildString: string;
    screenWidth: number;
    screenHeight: number;
    platform: string;
    store: string;
    distribution: string;
    ram: number;
    environmentId: string;
    jenkinsBuildBranchInfo: string;
    bundleId: string;
    graphicsDeviceName: string;
    graphicsShaderLevel: number;
    graphicsMemorySize: number;
    processorType: string;
    supportedTextureFormats: string;
};

// ============================================================
// Database Types (customize for your schema)
// ============================================================

export type PlayerMappingRecord = {
    player_id: string;
    display_name: string;
    guild_code: string;
    role: string;
    is_current: boolean;
    is_active: boolean;
    has_duplicate_name: boolean;
    original_display_name: string | null;
    updated_at: string;
    // Add your custom fields here
};

export type GuildConfigRecord = {
    guild_code: string;
    guild_id: string;
    user_id: string;
    session_id: string | null;
    client_secret: string;
    // Add your custom fields here
};
