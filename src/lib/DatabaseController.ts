import { DataTypes, Sequelize, Op } from "sequelize";
import { validateEnvVars, type DbTestResult } from "./db_utils";
import { logger } from "./HominaLogger";
import { CryptoService } from "./services/CryptoService";

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
     * @returns A promise that resolves to `true` if the registration was successful, or `false` if an error occurred.
     */
    public async registerUser(
        userId: string,
        token: string,
        guildId: string | null,
    ): Promise<boolean> {
        try {
            const encryptedToken = CryptoService.encrypt(token);
            await this.sequelize.models["discordApiTokenMappings"]?.upsert({
                userId: userId,
                token: encryptedToken,
                guildId: guildId,
                tokenLastUsed: new Date(),
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
}

export const dbController = new DatabaseController();
