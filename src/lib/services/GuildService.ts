import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController, logger } from "@/lib";
import { EncounterType, Rarity } from "@/models/enums";
import { testApiToken } from "../utils/commandUtils";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { RaidAnalyticsService } from "./RaidAnalyticsService";
import { HistoryService } from "./HistoryService";
import { AvailabilityService } from "./AvailabilityService";
import { MetaTeamService } from "./MetaTeamService";

/**
 * Service class for managing guild-related operations.
 *
 * Core responsibilities: guild identity, member resolution, token validation,
 * and season config lookups. Analytics, history, availability, and meta-team
 * methods are delegated to focused service classes.
 */
export class GuildService {
    private client: HominaTacticusClient;
    private db: DatabaseController;
    private raidAnalytics: RaidAnalyticsService;
    private history: HistoryService;
    private availability: AvailabilityService;
    private metaTeam: MetaTeamService;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
        this.raidAnalytics = new RaidAnalyticsService(client, db);
        this.history = new HistoryService(client, db);
        this.availability = new AvailabilityService(client, db);
        this.metaTeam = new MetaTeamService(client, db);
    }

    // ─── Core guild methods ─────────────────────────────────────────────

    async getGuildId(discordId: string): Promise<string | null> {
        try {
            const cachedGuildId = await this.db.getGuildIdByUserId(discordId);
            if (cachedGuildId) {
                return cachedGuildId;
            }

            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                return null;
            }

            const guildId = resp.guild.guildId;
            await this.db.updateGuildId(discordId, guildId);

            return guildId;
        } catch (error) {
            logger.error(error, "Error fetching guild ID");
            return null;
        }
    }

    async getGuildMembers(discordId: string): Promise<string[] | null> {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                throw new Error("API key not found for user: " + discordId);
            }

            const resp = await this.client.getGuild(apiKey);

            if (!resp.success || !resp.guild) {
                throw new Error("Failed to fetch guild for user: " + discordId);
            }

            return resp.guild.members.map((member) => member.userId);
        } catch (error) {
            logger.error(error, "Error fetching guild members");
            return null;
        }
    }

    async testRegisteredGuildApiToken(
        userId: string,
    ): Promise<{ status: boolean; message: string }> {
        try {
            const apiToken = await this.db.getUserToken(userId);
            if (!apiToken) {
                return {
                    status: false,
                    message: "No API token found for user",
                };
            }

            const resp = await testApiToken(apiToken);
            if (!resp) {
                return { status: false, message: "Invalid API token" };
            }
            return { status: true, message: "API token is valid" };
        } catch (error) {
            logger.error(error, "Error testing player API token");
            return {
                status: false,
                message:
                    "Something went horribly wrong while testing your token. Please register it again.",
            };
        }
    }

    async fetchGuildMembers(discordId: string) {
        try {
            const guildId = await this.getGuildId(discordId);
            if (!guildId) {
                logger.error("No guild ID found for user:", discordId);
                return null;
            }

            const members = await fetchGuildMembers(guildId);
            if (!members) {
                logger.error("No members found for guild ID:", guildId);
                return null;
            }

            const metadata = await this.db.getAllPlayerMetadataByGuild(guildId);
            if (metadata.length > 0) {
                const nicknameMap = new Map<string, string>();
                for (const entry of metadata) {
                    if (entry.nickname) {
                        nicknameMap.set(entry.userId, entry.nickname);
                    }
                }
                for (const member of members) {
                    const nickname = nicknameMap.get(member.userId);
                    if (nickname) {
                        member.displayName = nickname;
                    }
                }
            }

            return members;
        } catch (error) {
            logger.error(error, "Error fetching LOKI guild members: ");
            return null;
        }
    }

    async verifySameGuild(
        discordId: string,
        targetGuildId: string,
    ): Promise<boolean> {
        const callerGuildId = await this.getGuildId(discordId);
        return callerGuildId === targetGuildId;
    }

    async getNLastSeasonConfigs(discordId: string, nSeasons: number) {
        const apikey = await this.db.getUserToken(discordId);
        if (!apikey) {
            logger.error("No API key found for user:", discordId);
            return null;
        }

        const currentSeason =
            await this.client.getGuildRaidByCurrentSeason(apikey);
        if (!currentSeason || !currentSeason.season) {
            logger.error("No current season found for user:", discordId);
            return null;
        }

        const currentSeasonNumber = currentSeason.season;
        const seasons: number[] = [];
        for (let i = nSeasons; i > 0; i--) {
            if (currentSeasonNumber - i < 70) {
                break;
            }
            seasons.push(currentSeasonNumber - i);
        }
        seasons.push(currentSeasonNumber);

        const seasonPromises = seasons.map(
            async (season) =>
                await this.client.getGuildRaidBySeason(apikey, season),
        );

        const responses = await Promise.all(seasonPromises);

        const configs = responses.map((resp) => ({
            config: Number(resp.seasonConfigId.at(-1)),
            season: resp.season,
        }));

        return configs;
    }

    async getSeasonsWithSameConfig(
        discordId: string,
        nSeasons: number,
        season: number,
    ) {
        const apikey = await this.db.getUserToken(discordId);
        if (!apikey) {
            logger.error("No API key found for user:", discordId);
            return null;
        }

        try {
            const desiredSeason = await this.client.getGuildRaidBySeason(
                apikey,
                season,
            );

            if (!desiredSeason || !desiredSeason.season) {
                logger.error("No current season found for user:", discordId);
                return null;
            }

            const desiredConfig = desiredSeason.seasonConfigId;

            if (!desiredConfig) {
                logger.error(
                    `No season config found for season ${season} for user:`,
                    discordId,
                );
                return null;
            }

            const currentSeasonNumber = desiredSeason.season;
            const seasons: number[] = [];
            for (let i = nSeasons; i > 0; i--) {
                if (currentSeasonNumber - i < 70) {
                    break;
                }
                seasons.push(currentSeasonNumber - i);
            }

            const seasonPromises = seasons.map(
                async (season) =>
                    await this.client
                        .getGuildRaidBySeason(apikey, season)
                        .catch(() => null),
            );

            const responses = await Promise.all(seasonPromises);

            const result = responses
                .filter(
                    (resp) =>
                        resp &&
                        resp.seasonConfigId.at(-1) === desiredConfig.at(-1),
                )
                .map((resp) => resp!.season);

            return result;
        } catch (error) {
            logger.error(
                error,
                `Error fetching desired season ${season} for user:`,
                discordId,
            );
        }
    }

    // ─── Delegated methods (facade for backward compatibility) ──────────

    async getGuildRaidResultBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
        includePrimes: boolean = true,
    ) {
        return this.raidAnalytics.getGuildRaidResultBySeason(
            discordId,
            season,
            rarity,
            includePrimes,
        );
    }

    async getGuildRaidResultByRaritySeasonPerBoss(
        discordId: string,
        season: number,
        rarity?: Rarity,
        filterBombs: boolean = false,
        encounterTypeFilter?: EncounterType,
    ) {
        return this.raidAnalytics.getGuildRaidResultByRaritySeasonPerBoss(
            discordId,
            season,
            rarity,
            filterBombs,
            encounterTypeFilter,
        );
    }

    async getGuildRaidBombsBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ) {
        return this.raidAnalytics.getGuildRaidBombsBySeason(
            discordId,
            season,
            rarity,
        );
    }

    async getGuildRaidBySeason(
        discordId: string,
        season: number,
        rarity?: Rarity,
    ) {
        return this.raidAnalytics.getGuildRaidBySeason(
            discordId,
            season,
            rarity,
        );
    }

    async getMemberStatsInLastSeasons(
        discordId: string,
        nSeasons: number,
        rarity?: Rarity,
    ) {
        return this.raidAnalytics.getMemberStatsInLastSeasons(
            discordId,
            nSeasons,
            rarity,
        );
    }

    async getWeightedRelativePerformance(
        discordId: string,
        season: number,
        rarity?: Rarity,
        seasonCount: number = 1,
    ) {
        return this.raidAnalytics.getWeightedRelativePerformance(
            discordId,
            season,
            rarity,
            seasonCount,
        );
    }

    async getTokenByHours(discordId: string) {
        return this.raidAnalytics.getTokenByHours(discordId);
    }

    async getMetaTeamDistribution(
        discordId: string,
        season: number,
        tier?: Rarity,
    ) {
        return this.metaTeam.getMetaTeamDistribution(discordId, season, tier);
    }

    async getMetaTeamDistributionPerPlayer(
        discordId: string,
        season: number,
        tier?: Rarity,
    ) {
        return this.metaTeam.getMetaTeamDistributionPerPlayer(
            discordId,
            season,
            tier,
        );
    }

    async getAvailableTokensAndBombs(discordId: string) {
        return this.availability.getAvailableTokensAndBombs(discordId);
    }

    async getAvailableBombs(discordId: string) {
        return this.availability.getAvailableBombs(discordId);
    }

    async getPlayerCooldowns(token: string) {
        return this.availability.getPlayerCooldowns(token);
    }

    async getAvailableTokensAndBombsWithMetadata(discordId: string) {
        return this.availability.getAvailableTokensAndBombsWithMetadata(
            discordId,
        );
    }

    async getAvailableBombsWithMetadata(discordId: string) {
        return this.availability.getAvailableBombsWithMetadata(discordId);
    }

    async getTokensUsedInLastSeasons(
        discordId: string,
        nSeasons: number,
        rarity?: Rarity,
    ) {
        return this.history.getTokensUsedInLastSeasons(
            discordId,
            nSeasons,
            rarity,
        );
    }

    async getTotalDamageInLastSeasons(discordId: string, nSeasons: number) {
        return this.history.getTotalDamageInLastSeasons(discordId, nSeasons);
    }

    async getBossesKilledInLastSeasons(
        discordId: string,
        nSeasons: number,
        startingSeason?: number,
    ) {
        return this.history.getBossesKilledInLastSeasons(
            discordId,
            nSeasons,
            startingSeason,
        );
    }

    async getLoopsCompletedInLastSeasons(discordId: string, nSeasons: number) {
        return this.history.getLoopsCompletedInLastSeasons(discordId, nSeasons);
    }

    async getTokensPerLoopBySeason(discordId: string, season: number) {
        return this.history.getTokensPerLoopBySeason(discordId, season);
    }

    async getTokensPerLoopByBoss(
        discordId: string,
        season: number,
        rarity: Rarity,
    ) {
        return this.history.getTokensPerLoopByBoss(discordId, season, rarity);
    }
}
