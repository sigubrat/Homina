import { DataTypes, Sequelize, Op, QueryTypes } from "sequelize";
import { validateEnvVars, type DbTestResult } from "./db_utils";
import { logger } from "./HominaLogger";
import { CryptoService } from "./services/CryptoService";
import { BotEventType } from "@/models/enums";

export interface EventCount {
    eventType: string;
    eventName: string | null;
    count: number;
}

export interface DailyEventCount {
    date: string;
    count: number;
}

export class DatabaseController {
    private sequelize: Sequelize;

    constructor() {
        validateEnvVars(["DB_NAME", "DB_USER", "DB_PWD"]);

        this.sequelize = new Sequelize(
            process.env.DB_NAME!,
            process.env.DB_USER!,
            process.env.DB_PWD!,
            {
                host: "localhost",
                dialect: "postgres",
                logging: () => {
                    return true;
                },
            },
        );

        this.defineModels();
    }

    public getSequelizeInstance(): Sequelize {
        return this.sequelize;
    }

    private async defineModels() {
        try {
            await this.sequelize.authenticate();
            console.log(
                "Constructor: Connection to the database has been established successfully.",
            );
            console.log("Attempting to define models and sync database...");
        } catch (error) {
            logger.error(error, "Unable to connect to the database:");
            process.exit(1);
        }

        // User-guild api token table - This table is used to store discord user-guild api token mapping
        this.sequelize.define(
            "discordApiTokenMappings",
            {
                userId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true,
                },
                token: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                guildId: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                tokenLastUsed: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
                invitedBy: {
                    type: DataTypes.STRING,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                hooks: {
                    beforeUpdate(attributes: any) {
                        if (!attributes.token) return;
                        attributes.token = CryptoService.encrypt(
                            attributes.token,
                        );
                    },
                    beforeCreate(attributes: any) {
                        if (!attributes.token) return;
                        attributes.token = CryptoService.encrypt(
                            attributes.token,
                        );
                    },
                    afterFind: (result: any) => {
                        if (!result) return;
                        if (Array.isArray(result)) {
                            result.forEach((row) => {
                                if (row.token)
                                    row.token = CryptoService.decrypt(
                                        row.token,
                                    );
                            });
                        } else if (result.token) {
                            result.token = CryptoService.decrypt(result.token);
                        }
                    },
                },
            },
        );

        // Bot analytics events table
        this.sequelize.define("botEvents", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            eventType: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            eventName: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            metadata: {
                type: DataTypes.JSONB,
                allowNull: true,
            },
        });

        //**
        // SCHEMA RELATIONSHIPS
        //  */
        // Define relationships with explicit foreign keys

        try {
            await this.sequelize.sync({ force: false });
            console.log("Models defined and database synced successfully.");
        } catch (error) {
            logger.error(error, "Error syncing database");
            process.exit(1);
        }
    }

    /**
     * Checks if the database connection is ready by attempting to authenticate with Sequelize.
     *
     * @returns {Promise<DbTestResult>} A promise that resolves to a `DbTestResult` indicating
     * whether the connection was successful (`isSuccess: true`) or failed (`isSuccess: false`).
     * If the connection fails, an error message is included in the result.
     */
    public async isReady(): Promise<DbTestResult> {
        try {
            await this.sequelize.authenticate();
            console.log("Database is ready for use");
        } catch (error) {
            logger.error(error, "Unable to connect to the database:");
            return {
                isSuccess: false,
                message: "Unable to connect to the database.",
            } as DbTestResult;
        }

        return { isSuccess: true } as DbTestResult;
    }

    /**
     * Registers a user by storing their encrypted token in the database.
     *
     * @param userId - The unique identifier of the user.
     * @param token - The token to be encrypted and stored.
     * @param guildId - The in-game guild ID associated with the token.
     * @param invitedBy - The Discord user ID of the person who invited this user (optional).
     * @returns A promise that resolves to `true` if the registration was successful, or `false` if an error occurred.
     */
    public async registerUser(
        userId: string,
        token: string,
        guildId: string,
        invitedBy?: string,
    ): Promise<boolean> {
        try {
            const encryptedToken = CryptoService.encrypt(token);
            await this.sequelize.models["discordApiTokenMappings"]?.upsert({
                userId: userId,
                token: encryptedToken,
                guildId: guildId,
                tokenLastUsed: new Date(),
                invitedBy: invitedBy ?? null,
            });

            return true;
        } catch (error) {
            logger.error(error, "Error storing registered user to database");
            return false;
        }
    }

    /**
     * Deletes a user from the `discordApiTokenMappings` table in the database.
     *
     * @param userId - The unique identifier of the user to delete.
     * @returns The number of rows deleted if successful, or `undefined` if an error occurred.
     *
     * @remarks
     * This method uses Sequelize's `destroy` function to remove the user record.
     * Any errors encountered during the operation are logged and result in an `undefined` return value.
     */
    public async deleteUser(userId: string): Promise<number | undefined> {
        try {
            const res = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.destroy({
                where: {
                    userId: userId,
                },
            });
            return res;
        } catch (error) {
            logger.error(error, "Error deleting user from database");
            return undefined;
        }
    }

    /**
     * Retrieves the total number of users from the `discordApiTokenMappings` model in the database.
     *
     * @returns {Promise<number>} The number of users found in the database. Returns 0 if an error occurs or if no users are found.
     */
    public async getNumberOfUsers(): Promise<number> {
        try {
            const res =
                await this.sequelize.models["discordApiTokenMappings"]?.count();
            return res || 0;
        } catch (error) {
            logger.error(
                error,
                "Error retrieving number of users from database",
            );
            return 0;
        }
    }

    /**
     * Retrieves the API token for a user by their Discord ID.
     * If the token is found, updates the `tokenLastUsed` field to the current date and time.
     * Returns the token as a string, or `null` if no token is found or an error occurs.
     *
     * @param discordId - The Discord user ID to look up.
     * @returns A promise that resolves to the user's token string, or `null` if not found or on error.
     */
    public async getUserToken(discordId: string): Promise<string | null> {
        try {
            const model = this.sequelize.models["discordApiTokenMappings"];
            const result = await model?.findOne({
                where: {
                    userId: discordId,
                },
            });
            if (!result) {
                return null;
            }

            // Update tokenLastUsed to now
            await model?.update(
                { tokenLastUsed: new Date() },
                { where: { userId: discordId } },
            );

            return result.get("token") as string;
        } catch (error) {
            logger.error(error, "Error retrieving user token from database");
            return null;
        }
    }

    /**
     * Retrieves the guild ID for a given Discord user ID.
     *
     * @param discordId - The Discord user ID to look up.
     * @returns The guild ID if found, or `null` if not found or an error occurs.
     */
    public async getGuildIdByUserId(discordId: string): Promise<string | null> {
        try {
            const result = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.findOne({
                where: { userId: discordId },
                attributes: ["guildId"],
            });
            return (result?.get("guildId") as string) || null;
        } catch (error) {
            logger.error(error, "Error fetching guild ID for user");
            return null;
        }
    }

    /**
     * Updates the guild ID for a given Discord user ID.
     *
     * @param discordId - The Discord user ID to update.
     * @param guildId - The guild ID to set.
     * @returns True if the update was successful, false otherwise.
     */
    public async updateGuildId(
        discordId: string,
        guildId: string,
    ): Promise<boolean> {
        try {
            await this.sequelize.models["discordApiTokenMappings"]?.update(
                { guildId },
                { where: { userId: discordId } },
            );
            return true;
        } catch (error) {
            logger.error(error, "Error updating guild ID for user");
            return false;
        }
    }

    /**
     * Counts the number of distinct in-game guilds registered in the database.
     *
     * @returns {Promise<number>} The number of distinct guilds. Returns 0 if an error occurs.
     */
    public async getGuildCount(): Promise<number> {
        try {
            const result = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.count({
                distinct: true,
                col: "guildId",
            });
            return result || 0;
        } catch (error) {
            logger.error(error, "Error counting distinct guilds");
            return 0;
        }
    }

    /**
     * Deletes old records from the database for Discord API token mappings
     * that have not been used within the specified maximum age in days.
     *
     * @param maxAgeInDays - The maximum age in days for tokens to keep. Records older than this will be deleted. Defaults to 30 days.
     * @returns A list of user IDs whose tokens were deleted.
     */
    public async cleanupOldTokens(
        maxAgeInDays: number = 30,
    ): Promise<string[]> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

            const deletedUsers = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.findAll({
                where: {
                    tokenLastUsed: {
                        [Op.lt]: cutoffDate,
                    },
                },
            });

            const deletedUserIds =
                (deletedUsers?.map((user) =>
                    user.getDataValue("userId"),
                ) as string[]) || [];

            const res = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.destroy({
                where: {
                    tokenLastUsed: {
                        [Op.lt]: cutoffDate,
                    },
                },
            });

            logger.info(
                `Deleted ${
                    res || 0
                } guild tokens from the database older than ${maxAgeInDays} days.`,
            );

            return deletedUserIds;
        } catch (error) {
            logger.error(error, "Error cleaning up old tokens in database");
            return [];
        }
    }
    /**
     * Retrieves all users invited by a given Discord user ID.
     *
     * @param discordId - The Discord user ID of the inviter.
     * @returns An array of user IDs invited by this user, or an empty array on error.
     */
    public async getInvitedUsers(discordId: string): Promise<string[]> {
        try {
            const results = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.findAll({
                where: { invitedBy: discordId },
                attributes: ["userId"],
            });
            return (
                results?.map((r) => r.getDataValue("userId") as string) || []
            );
        } catch (error) {
            logger.error(error, "Error fetching invited users");
            return [];
        }
    }

    // ==================== Bot Event Tracking ====================

    /**
     * Logs a bot analytics event to the database.
     * Silently catches errors to avoid disrupting bot operations.
     *
     * @param eventType - The type of event (command_use, command_error, user_register, user_delete).
     * @param eventName - An optional name for the event (e.g. the command name).
     * @param metadata - Optional JSON metadata for extra context.
     */
    public async logEvent(
        eventType: BotEventType,
        eventName?: string,
        metadata?: Record<string, unknown>,
    ): Promise<void> {
        try {
            await this.sequelize.models["botEvents"]?.create({
                eventType,
                eventName: eventName ?? null,
                metadata: metadata ?? null,
            });
        } catch (error) {
            logger.error(error, "Failed to log bot event");
        }
    }

    /**
     * Gets event counts grouped by event type and event name.
     * Optionally filters to events since a given date.
     *
     * @param since - Optional date to filter events from.
     * @returns An array of event counts grouped by type and name.
     */
    public async getEventCounts(since?: Date): Promise<EventCount[]> {
        try {
            const whereClause = since ? 'WHERE "createdAt" >= :since' : "";
            const results = await this.sequelize.query(
                `SELECT "eventType", "eventName", COUNT(*)::int as count
                 FROM "botEvents"
                 ${whereClause}
                 GROUP BY "eventType", "eventName"
                 ORDER BY count DESC`,
                {
                    replacements: since ? { since } : undefined,
                    type: QueryTypes.SELECT,
                },
            );
            return results as EventCount[];
        } catch (error) {
            logger.error(error, "Error fetching event counts");
            return [];
        }
    }

    /**
     * Gets daily event counts for a specific event type over a number of days.
     * Useful for trend/time-series analysis.
     *
     * @param eventType - The event type to filter on.
     * @param days - The number of days to look back (default: 30).
     * @returns An array of daily event counts.
     */
    public async getDailyEventCounts(
        eventType: BotEventType,
        days: number = 30,
    ): Promise<DailyEventCount[]> {
        try {
            const results = await this.sequelize.query(
                `SELECT DATE("createdAt") as date, COUNT(*)::int as count
                 FROM "botEvents"
                 WHERE "eventType" = :eventType
                   AND "createdAt" >= NOW() - INTERVAL '1 day' * :days
                 GROUP BY DATE("createdAt")
                 ORDER BY date ASC`,
                {
                    replacements: { eventType, days },
                    type: QueryTypes.SELECT,
                },
            );
            return results as DailyEventCount[];
        } catch (error) {
            logger.error(error, "Error fetching daily event counts");
            return [];
        }
    }

    /**
     * Gets cumulative totals for all event types.
     *
     * @returns An object with total counts for each event type.
     */
    public async getCumulativeMetrics(): Promise<{
        totalCommandUses: number;
        totalCommandErrors: number;
        totalRegistrations: number;
        totalDeletions: number;
        errorRate: number;
    }> {
        try {
            const results = await this.sequelize.query(
                `SELECT "eventType", COUNT(*)::int as count
                 FROM "botEvents"
                 GROUP BY "eventType"`,
                { type: QueryTypes.SELECT },
            );

            const counts: Record<string, number> = {};
            for (const row of results as {
                eventType: string;
                count: number;
            }[]) {
                counts[row.eventType] = row.count;
            }

            const totalCommandUses = counts[BotEventType.COMMAND_USE] ?? 0;
            const totalCommandErrors = counts[BotEventType.COMMAND_ERROR] ?? 0;
            const totalCommands = totalCommandUses + totalCommandErrors;

            return {
                totalCommandUses,
                totalCommandErrors,
                totalRegistrations: counts[BotEventType.USER_REGISTER] ?? 0,
                totalDeletions: counts[BotEventType.USER_DELETE] ?? 0,
                errorRate:
                    totalCommands > 0 ? totalCommandErrors / totalCommands : 0,
            };
        } catch (error) {
            logger.error(error, "Error fetching cumulative metrics");
            return {
                totalCommandUses: 0,
                totalCommandErrors: 0,
                totalRegistrations: 0,
                totalDeletions: 0,
                errorRate: 0,
            };
        }
    }

    /**
     * Gets command usage counts, sorted by most used.
     *
     * @param since - Optional date to filter events from.
     * @param limit - Maximum number of commands to return (default: 15).
     * @returns An array of command names and their usage counts.
     */
    public async getCommandUsageCounts(
        since?: Date,
        limit: number = 15,
    ): Promise<{ commandName: string; uses: number; errors: number }[]> {
        try {
            const whereClause = since ? 'AND "createdAt" >= :since' : "";
            const results = await this.sequelize.query(
                `SELECT
                    "eventName" as "commandName",
                    COUNT(*) FILTER (WHERE "eventType" = '${BotEventType.COMMAND_USE}')::int as uses,
                    COUNT(*) FILTER (WHERE "eventType" = '${BotEventType.COMMAND_ERROR}')::int as errors
                 FROM "botEvents"
                 WHERE "eventType" IN ('${BotEventType.COMMAND_USE}', '${BotEventType.COMMAND_ERROR}')
                   AND "eventName" IS NOT NULL
                   ${whereClause}
                 GROUP BY "eventName"
                 ORDER BY uses DESC
                 LIMIT :limit`,
                {
                    replacements: { ...(since ? { since } : {}), limit },
                    type: QueryTypes.SELECT,
                },
            );
            return results as {
                commandName: string;
                uses: number;
                errors: number;
            }[];
        } catch (error) {
            logger.error(error, "Error fetching command usage counts");
            return [];
        }
    }

    /**
     * Gets daily command usage counts broken down by command name.
     * Returns data suitable for a multi-line time-series chart.
     *
     * @param days - Number of days to look back (default: 30).
     * @param limit - Maximum number of commands to include (default: 10, by total usage).
     * @returns An object mapping command names to arrays of { date, count }.
     */
    public async getDailyCommandUsage(
        days: number = 30,
        limit: number = 10,
    ): Promise<Record<string, { date: string; count: number }[]>> {
        try {
            const topCommands = (await this.sequelize.query(
                `SELECT "eventName", COUNT(*)::int as total
                 FROM "botEvents"
                 WHERE "eventType" = '${BotEventType.COMMAND_USE}'
                   AND "eventName" IS NOT NULL
                   AND "createdAt" >= NOW() - INTERVAL '1 day' * :days
                 GROUP BY "eventName"
                 ORDER BY total DESC
                 LIMIT :limit`,
                {
                    replacements: { days, limit },
                    type: QueryTypes.SELECT,
                },
            )) as { eventName: string; total: number }[];

            if (topCommands.length === 0) return {};

            const commandNames = topCommands.map((c) => c.eventName);

            const results = (await this.sequelize.query(
                `SELECT DATE("createdAt") as date, "eventName", COUNT(*)::int as count
                 FROM "botEvents"
                 WHERE "eventType" = '${BotEventType.COMMAND_USE}'
                   AND "eventName" IN (:commandNames)
                   AND "createdAt" >= NOW() - INTERVAL '1 day' * :days
                 GROUP BY DATE("createdAt"), "eventName"
                 ORDER BY date ASC`,
                {
                    replacements: { commandNames, days },
                    type: QueryTypes.SELECT,
                },
            )) as { date: string; eventName: string; count: number }[];

            const grouped: Record<string, { date: string; count: number }[]> =
                {};
            for (const name of commandNames) {
                grouped[name] = [];
            }
            for (const row of results) {
                if (!grouped[row.eventName]) {
                    grouped[row.eventName] = [];
                }
                grouped[row.eventName]!.push({
                    date: row.date,
                    count: row.count,
                });
            }

            return grouped;
        } catch (error) {
            logger.error(error, "Error fetching daily command usage");
            return {};
        }
    }

    /**
     * Cleans up old bot events from the database.
     *
     * @param maxAgeInDays - The maximum age in days for events to keep. Defaults to 90 days.
     * @returns The number of events deleted.
     */
    public async cleanupOldEvents(maxAgeInDays: number = 90): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

            const res = await this.sequelize.models["botEvents"]?.destroy({
                where: {
                    createdAt: {
                        [Op.lt]: cutoffDate,
                    },
                },
            });

            logger.info(
                `Cleaned up ${res || 0} bot events older than ${maxAgeInDays} days.`,
            );
            return res || 0;
        } catch (error) {
            logger.error(error, "Error cleaning up old bot events");
            return 0;
        }
    }

    // ==================== Invite Management ====================

    /**
     * Revokes access for a user invited by the specified inviter.
     * Any users that the revoked user had themselves invited are re-parented
     * to the inviter, so the inviter inherits management of the chain.
     *
     * @param userId - The user ID to revoke access for.
     * @param inviterId - The Discord user ID of the inviter.
     * @returns True if the user was deleted, false otherwise.
     */
    public async revokeInvitedUser(
        userId: string,
        inviterId: string,
    ): Promise<boolean> {
        try {
            const model = this.sequelize.models["discordApiTokenMappings"];

            await model?.update(
                { invitedBy: inviterId },
                { where: { invitedBy: userId } },
            );

            const res = await model?.destroy({
                where: {
                    userId: userId,
                    invitedBy: inviterId,
                },
            });
            return (res ?? 0) > 0;
        } catch (error) {
            logger.error(error, "Error revoking invited user");
            return false;
        }
    }
}

export const dbController = new DatabaseController();
