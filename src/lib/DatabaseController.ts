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
                host: "localhost",
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

    public async cleanupOldTokens(maxAgeInDays: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays);

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

            return res || 0;
        } catch (error) {
            logger.error(error, "Error cleaning up old tokens in database");
            return 0;
        }
    }

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

    public async getMemberCount() {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.count();

            return result || 0;
        } catch (error) {
            logger.error(error, "Error retrieving member count from database");
            return 0;
        }
    }

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
