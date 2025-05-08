import { DataTypes, Sequelize } from "sequelize";
import { validateEnvVars, type DbTestResult } from "./db_utils";
import type { GuildMemberMapping } from "@/models/types/GuildMemberMapping";
import { logger } from "./pino-logger";

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
        this.sequelize.define("GuildMembers", {
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
        });

        // User-guild api token table - This table is used to store discord user-guild api token mapping
        this.sequelize.define("discordApiTokenMappings", {
            userId: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            token: {
                type: DataTypes.STRING,
                allowNull: false,
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
            await this.sequelize.models["discordApiTokenMappings"]?.upsert({
                userId: userId,
                token: token,
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

    public async getUserToken(userId: string): Promise<string | null> {
        try {
            const result = await this.sequelize.models[
                "discordApiTokenMappings"
            ]?.findOne({
                where: {
                    userId: userId,
                },
            });
            if (!result) {
                return null;
            }

            return result.getDataValue("token") as string;
        } catch (error) {
            logger.error(error, "Error retrieving user token from database");
            return null;
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

            return result.map((member) => {
                return {
                    userId: member.getDataValue("userId") as string,
                    username: member.getDataValue("username") as string,
                } as GuildMemberMapping;
            });
        } catch (error) {
            logger.error(error, "Error retrieving player name from database");
            return null;
        }
    }
    public async getPlayerName(userId: string): Promise<string | null> {
        try {
            const result = await this.sequelize.models["GuildMembers"]?.findOne(
                {
                    where: {
                        userId: userId,
                    },
                }
            );
            if (!result) {
                return null;
            }

            return result.getDataValue("username") as string;
        } catch (error) {
            logger.error(error, "Error retrieving player name from database");
            return null;
        }
    }

    public async updatePlayerName(
        userId: string,
        name: string,
        guildId: string
    ): Promise<boolean> {
        try {
            const guildMembersModel = this.sequelize.models["GuildMembers"];
            if (!guildMembersModel) {
                logger.error("GuildMembers model is not defined.");
                return false;
            }

            const res = await guildMembersModel.upsert({
                userId: userId,
                username: name,
                guildId: guildId,
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

    public async deletePlayerName(
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
}

export const dbController = new DatabaseController();
