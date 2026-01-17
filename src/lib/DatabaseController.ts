import { DataTypes, Sequelize, Op } from "sequelize";
import { validateEnvVars, type DbTestResult } from "./db_utils";
import type { GuildMemberMapping } from "@/models/types/GuildMemberMapping";
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
                host: process.env.DB_HOST || "localhost",
                dialect: "postgres",
                logging: () => {
                    return true;
                },
            }
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
                "Constructor: Connection to the database has been established successfully."
            );
            console.log("Attempting to define models and sync database...");
        } catch (error) {
            logger.error(error, "Unable to connect to the database:");
            process.exit(1);
        }

        // GuildMember table
        this.sequelize.define(
            "GuildMembers",
            {
                userId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true,
                },
                username: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                guildId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                playerToken: {
                    type: DataTypes.STRING,
                    allowNull: true,
                },
                lastAccessed: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
            },
            {
                hooks: {
                    beforeUpsert(attributes: any) {
                        if (!attributes.playerToken) return;
                        attributes.playerToken = CryptoService.encrypt(
                            attributes.playerToken
                        );
                    },
                    beforeUpdate(attributes: any) {
                        if (!attributes.playerToken) return;
                        attributes.playerToken = CryptoService.encrypt(
                            attributes.playerToken
                        );
                    },
                    afterFind: (result: any) => {
                        if (!result) return;
                        if (Array.isArray(result)) {
                            result.forEach((row) => {
                                if (row.playerToken)
                                    row.playerToken = CryptoService.decrypt(
                                        row.playerToken
                                    );
                            });
                        } else if (result.playerToken) {
                            result.playerToken = CryptoService.decrypt(
                                result.playerToken
                            );
                        }
                    },
                },
            }
        );

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
                            attributes.token
                        );
                    },
                    beforeCreate(attributes: any) {
                        if (!attributes.token) return;
                        attributes.token = CryptoService.encrypt(
                            attributes.token
                        );
                    },
                    afterFind: (result: any) => {
                        if (!result) return;
                        if (Array.isArray(result)) {
                            result.forEach((row) => {
                                if (row.token)
                                    row.token = CryptoService.decrypt(
                                        row.token
                                    );
                            });
                        } else if (result.token) {
                            result.token = CryptoService.decrypt(result.token);
                        }
                    },
                },
            }
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
     * @returns A promise that resolves to `true` if the registration was successful, or `false` if an error occurred.
     */
    public async registerUser(userId: string, token: string): Promise<boolean> {
        try {
            const encryptedToken = CryptoService.encrypt(token);
            await this.sequelize.models["discordApiTokenMappings"]?.upsert({
                userId: userId,
                token: encryptedToken,
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
            const res = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.count();
            return res || 0;
        } catch (error) {
            logger.error(
                error,
                "Error retrieving number of users from database"
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
                { where: { userId: discordId } }
            );

            return result.get("token") as string;
        } catch (error) {
            logger.error(error, "Error retrieving user token from database");
            return null;
        }
    }

    /**
     * Deletes old records from the database for Discord API token mappings and guild members
     * that have not been used or accessed within the specified maximum age in days.
     *
     * @param maxAgeInDays - The maximum age in days for tokens and guild members to keep. Records older than this will be deleted. Defaults to 30 days.
     * @returns A list of user IDs whose tokens were deleted.
     */
    public async cleanupOldTokens(
        maxAgeInDays: number = 30
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
                    user.getDataValue("userId")
                ) as string[]) || [];

            let res = await this.sequelize.models[
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
                } guild tokens from the database older than ${maxAgeInDays} days.`
            );

            res = await this.sequelize.models["GuildMembers"]?.destroy({
                where: {
                    lastAccessed: {
                        [Op.lt]: cutoffDate,
                    },
                },
            });

            logger.info(
                `Deleted ${
                    res || 0
                } guild members from the database older than ${maxAgeInDays} days.`
            );

            return deletedUserIds;
        } catch (error) {
            logger.error(error, "Error cleaning up old tokens in database");
            return [];
        }
    }

    /**
     * Updates the guild members for a given guild in a transactional manner.
     *
     * This method performs the following steps within a transaction:
     * - Retrieves the current guild members for the specified guild.
     * - Deletes members that are no longer present in the provided list.
     * - Upserts (inserts or updates) the provided members.
     * - Commits the transaction if all operations succeed, otherwise rolls back on error.
     *
     * @param guildId - The ID of the guild whose members are to be updated.
     * @param members - An array of `GuildMemberMapping` objects representing the desired state of guild members.
     * @returns A promise that resolves to the number of members updated, or -1 if an error occurs.
     */
    public async updateGuildMembersTransactional(
        guildId: string,
        members: GuildMemberMapping[]
    ): Promise<number> {
        let updatedCount = 0;
        const sequelize = this.getSequelizeInstance();
        const t = await sequelize.transaction();
        try {
            const guildMembers = await this.getGuildMembersByGuildId(guildId);
            if (!guildMembers) {
                await t.rollback();
                return -1;
            }

            const guildMemberIds = guildMembers.map((member) => member.userId);
            const membersToDelete = guildMemberIds.filter(
                (id) => !members.some((member) => member.userId === id)
            );

            for (const id of membersToDelete) {
                const result = await this.sequelize.models[
                    "GuildMembers"
                ]?.destroy({
                    where: { userId: id, guildId },
                    transaction: t,
                });
                if (!result) {
                    continue;
                }
            }

            for (const member of members) {
                const result = await this.sequelize.models[
                    "GuildMembers"
                ]?.upsert(
                    {
                        userId: member.userId,
                        username: member.username,
                        guildId,
                    },
                    { transaction: t }
                );
                if (!result) {
                    continue;
                }
                updatedCount += 1;
            }

            await t.commit();
            return updatedCount;
        } catch (error) {
            await t.rollback();
            logger.error(
                error,
                "Error updating guild members (transactional): "
            );
            return -1;
        }
    }

    /**
     * Retrieves all guild members associated with a given guild ID from the database.
     *
     * This method fetches the members from the "GuildMembers" model, maps the results to
     * `GuildMemberMapping` objects, and updates the `lastAccessed` timestamp for all members
     * in the specified guild.
     *
     * @param guildId - The unique identifier of the guild whose members are to be retrieved.
     * @returns An array of `GuildMemberMapping` objects if members are found, or `null` if none are found or an error occurs.
     * @throws Logs any errors encountered during the database operations.
     */
    public async getGuildMembersByGuildId(guildId: string) {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findAll(
                {
                    where: {
                        guildId: guildId,
                    },
                }
            );
            if (!result) {
                return null;
            }

            const res = result.map((member) => {
                return {
                    userId: member.getDataValue("userId") as string,
                    username: member.getDataValue("username") as string,
                    hasPlayerToken: !!member.getDataValue("playerToken"),
                } as GuildMemberMapping;
            });

            // Update lastAccessed for all members in the guild
            await this.sequelize.models["GuildMembers"]?.update(
                { lastAccessed: new Date() },
                { where: { guildId: guildId } }
            );

            return res;
        } catch (error) {
            logger.error(error, "Error retrieving player name from database");
            return null;
        }
    }

    /**
     * Retrieves the username of a player from the database based on the provided user ID and guild ID.
     * If the player is found, updates their `lastAccessed` timestamp to the current date.
     * Returns the username as a string, or `null` if the player is not found or an error occurs.
     *
     * @param userId - The unique identifier of the user.
     * @param guildId - The unique identifier of the guild.
     * @returns A promise that resolves to the player's username as a string, or `null` if not found.
     */
    public async getPlayerName(
        userId: string,
        guildId: string
    ): Promise<string | null> {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findOne(
                {
                    where: {
                        userId: userId,
                        guildId: guildId,
                    },
                }
            );
            if (!result) {
                return null;
            }

            await this.sequelize.models["GuildMembers"]?.update(
                { lastAccessed: new Date() },
                { where: { userId: userId } }
            );

            return result.getDataValue("username") as string;
        } catch (error) {
            logger.error(error, "Error retrieving player name from database");
            return null;
        }
    }

    /**
     * Retrieves the usernames of players based on their user IDs within a specific guild.
     *
     * @param userIds - An array of user IDs to look up.
     * @param guildId - The ID of the guild to filter members by.
     * @returns A promise that resolves to a record mapping user IDs to usernames.
     *          If no matching members are found, returns an empty object.
     * @throws Logs an error and returns an empty object if the database query fails.
     */
    public async getPlayerNames(
        userIds: string[],
        guildId: string
    ): Promise<Record<string, string>> {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findAll(
                {
                    where: {
                        userId: {
                            [Op.in]: userIds,
                        },
                        guildId: guildId,
                    },
                }
            );

            const playerNames: Record<string, string> = {};
            if (!result || result.length === 0) {
                return playerNames;
            }
            result.forEach((member) => {
                playerNames[member.getDataValue("userId") as string] =
                    member.getDataValue("username") as string;
            });

            return playerNames;
        } catch (error) {
            logger.error(error, "Error retrieving player names from database");
            return {};
        }
    }

    /**
     * Retrieves the total number of guild members from the database.
     *
     * @returns {Promise<number>} The count of guild members, or 0 if an error occurs.
     *
     * @throws Logs an error and returns 0 if the database query fails.
     */
    public async getMemberCount() {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.count();

            return result || 0;
        } catch (error) {
            logger.error(error, "Error retrieving member count from database");
            return 0;
        }
    }

    /**
     * Retrieves the player key status for all members of a specified guild.
     *
     * Queries the `GuildMembers` model for all members belonging to the given `guildId`.
     * Returns an object mapping each member's username to a boolean indicating whether
     * they have a non-empty player token. Also updates the `lastAccessed` timestamp
     * for all members of the guild.
     *
     * @param guildId - The unique identifier of the guild whose members are being queried.
     * @returns A promise that resolves to a record mapping usernames to a boolean indicating
     *          the presence of a player token. Returns an empty object if no members are found
     *          or if an error occurs.
     */
    public async getGuildMembersPlayerKeyStatus(
        guildId: string
    ): Promise<Record<string, boolean>> {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findAll(
                {
                    where: {
                        guildId: guildId,
                    },
                }
            );

            if (!result) {
                return {};
            }

            await this.sequelize.models["GuildMembers"]?.update(
                { lastAccessed: new Date() },
                { where: { guildId: guildId } }
            );

            const retval: Record<string, boolean> = {};
            result.forEach((member) => {
                const username = member.getDataValue("username") as string;
                const playerToken = member.getDataValue(
                    "playerToken"
                ) as string;
                retval[username] = !!playerToken && playerToken.length > 0;
            });
            return retval;
        } catch (error) {
            logger.error(
                error,
                `Error retrieving guild members player key status for guildId: ${guildId}`
            );
            return {};
        }
    }

    /**
     * Retrieves the total number of distinct guilds from the database.
     *
     * Counts the unique occurrences of `guildId` in the `GuildMembers` model.
     * Returns `0` if an error occurs or if no guilds are found.
     *
     * @returns {Promise<number>} The count of distinct guilds.
     */
    public async getGuildCount() {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.count({
                distinct: true,
                col: "guildId",
            });

            return result || 0;
        } catch (error) {
            logger.error(error, "Error retrieving guild count from database");
            return 0;
        }
    }

    /**
     * Retrieves the user ID of a guild member by their username and guild ID.
     * If the member is found, updates their `lastAccessed` timestamp to the current date.
     *
     * @param username - The username of the guild member.
     * @param guildId - The ID of the guild.
     * @returns The user ID as a string if found, otherwise `null`.
     * @throws Logs an error and returns `null` if retrieval fails.
     */
    public async getGuildMemberIdByUsername(username: string, guildId: string) {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findOne(
                {
                    where: {
                        username: username,
                        guildId: guildId,
                    },
                }
            );

            if (!result) {
                return null;
            }

            await this.sequelize.models["GuildMembers"]?.update(
                { lastAccessed: new Date() },
                { where: { username: username, guildId: guildId } }
            );

            return result.getDataValue("userId") as string;
        } catch (error) {
            logger.error(
                error,
                `Error retrieving guild member ID for username: ${username}, guildId: ${guildId}`
            );
            return null;
        }
    }

    /**
     * Retrieves the player token for a specific user in a given guild.
     *
     * This method queries the `GuildMembers` model to find the record matching the provided
     * `userId` and `guildId`. If found, it updates the `lastAccessed` timestamp for the user
     * and returns the associated `playerToken`. If no record is found or an error occurs,
     * it returns `null`.
     *
     * @param userId - The unique identifier of the user.
     * @param guildId - The unique identifier of the guild.
     * @returns A promise that resolves to the player's token as a string, or `null` if not found or on error.
     */
    public async getPlayerToken(
        userId: string,
        guildId: string
    ): Promise<string | null> {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findOne(
                {
                    where: {
                        userId: userId,
                        guildId: guildId,
                    },
                }
            );
            if (!result) {
                return null;
            }

            await this.sequelize.models["GuildMembers"]?.update(
                { lastAccessed: new Date() },
                { where: { userId: userId, guildId: guildId } }
            );

            return result.get("playerToken") as string;
        } catch (error) {
            logger.error(error, "Error retrieving player token from database");
            return null;
        }
    }

    /**
     * Retrieves all player tokens associated with the specified guild ID.
     * Also updates the `lastAccessed` timestamp for all members in the guild.
     *
     * @param guildId - The unique identifier of the guild.
     * @returns A promise that resolves to an array of player token strings.
     *          Returns an empty array if no tokens are found or if an error occurs.
     */
    public async getPlayerTokens(guildId: string) {
        try {
            const guildMembersModel = this.sequelize.models["GuildMembers"];
            if (!guildMembersModel) {
                logger.error("GuildMembers model is not defined.");
                return [];
            }

            const result = await guildMembersModel.findAll({
                where: {
                    guildId: guildId,
                },
                attributes: ["playerToken"],
            });

            if (!result || result.length === 0) {
                return [];
            }

            // Update lastAccessed for all members in the guild
            await guildMembersModel.update(
                { lastAccessed: new Date() },
                { where: { guildId: guildId } }
            );

            // return all tokens as an array
            return result.map((member) => {
                return member.getDataValue("playerToken") as string;
            });
        } catch (error) {
            logger.error(
                error,
                `Error retrieving player tokens for guildId: ${guildId}`
            );
            return [];
        }
    }

    /**
     * Sets or updates the player's API token for a specific user and guild.
     *
     * Encrypts the provided API token before storing it in the database.
     * Uses the `upsert` operation to insert or update the record in the `GuildMembers` model.
     * Updates the `lastAccessed` timestamp to the current date.
     *
     * @param userId - The unique identifier of the user.
     * @param guildId - The unique identifier of the guild.
     * @param apiToken - The API token to be stored for the player.
     * @returns A promise that resolves to `true` if the operation was successful, or `false` otherwise.
     */
    public async setPlayerToken(
        userId: string,
        guildId: string,
        apiToken: string
    ): Promise<boolean> {
        try {
            const guildMembersModel = this.sequelize.models["GuildMembers"];
            if (!guildMembersModel) {
                logger.error("GuildMembers model is not defined.");
                return false;
            }

            if (apiToken) {
                apiToken = CryptoService.encrypt(apiToken);
            }

            const res = await guildMembersModel.upsert({
                userId: userId,
                guildId: guildId,
                playerToken: apiToken,
                lastAccessed: new Date(),
            });

            if (!res) {
                logger.error(
                    `Error setting player token for userId: ${userId}`
                );
                return false;
            }

            return true;
        } catch (error) {
            logger.error(
                error,
                `Error setting player token for userId: ${userId}, guildId: ${guildId}`
            );
            return false;
        }
    }

    /**
     * Updates the player's name and optionally their API token in the database for a specific guild.
     *
     * If an `apiToken` is provided, it will be encrypted before being stored.
     * The method uses an upsert operation to either update an existing record or insert a new one
     * in the `GuildMembers` model. The `lastAccessed` field is updated to the current date and time.
     *
     * @param userId - The unique identifier of the user whose name is to be updated.
     * @param name - The new name to assign to the player.
     * @param guildId - The unique identifier of the guild to which the player belongs.
     * @param apiToken - (Optional) The API token to associate with the player. If provided, it will be encrypted.
     * @returns A promise that resolves to `true` if the update was successful, or `false` if an error occurred.
     */
    public async updatePlayerName(
        userId: string,
        name: string,
        guildId: string,
        apiToken?: string
    ): Promise<boolean> {
        try {
            const guildMembersModel = this.sequelize.models["GuildMembers"];
            if (!guildMembersModel) {
                logger.error("GuildMembers model is not defined.");
                return false;
            }

            if (apiToken) {
                apiToken = CryptoService.encrypt(apiToken);
            }

            const res = await guildMembersModel.upsert({
                userId: userId,
                username: name,
                guildId: guildId,
                playerToken: apiToken,
                lastAccessed: new Date(),
            });

            if (!res) {
                logger.error(`Error updating player name ${name} in database.`);
                return false;
            }

            return true;
        } catch (error) {
            logger.error(
                `Error updating player name for userId: ${userId}, name: ${name}`,
                error
            );
            return false;
        }
    }

    /**
     * Deletes a player's name from the GuildMembers table by user ID and guild ID.
     *
     * @param userId - The unique identifier of the user whose player name should be deleted.
     * @param guildId - The unique identifier of the guild from which the player's name should be deleted.
     * @returns A promise that resolves to the number of rows deleted, or -1 if an error occurs.
     */
    public async deletePlayerNameById(
        userId: string,
        guildId: string
    ): Promise<number> {
        try {
            const guildMembersModel = this.sequelize.models["GuildMembers"];
            if (!guildMembersModel) {
                logger.error("GuildMembers model is not defined.");
                return -1;
            }

            return await guildMembersModel.destroy({
                where: {
                    userId: userId,
                    guildId: guildId,
                },
            });
        } catch (error) {
            logger.error(
                error,
                `Error deleting player name for userId: ${userId}`
            );
            return -1;
        }
    }

    /**
     * Deletes a player's name from the GuildMembers model based on the provided username and guild ID.
     *
     * @param username - The username of the player whose name should be deleted.
     * @param guildId - The ID of the guild to which the player belongs.
     * @returns A promise that resolves to the number of records deleted, or -1 if an error occurs.
     */
    public async deletePlayerNameByUsername(
        username: string,
        guildId: string
    ): Promise<number> {
        try {
            const guildMembersModel = this.sequelize.models["GuildMembers"];
            if (!guildMembersModel) {
                logger.error("GuildMembers model is not defined.");
                return -1;
            }

            return await guildMembersModel.destroy({
                where: {
                    username: username,
                    guildId: guildId,
                },
            });
        } catch (error) {
            logger.error(
                error,
                `Error deleting player name for username: ${username}`
            );
            return -1;
        }
    }
}

export const dbController = new DatabaseController();
