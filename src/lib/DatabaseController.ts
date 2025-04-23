import { DataTypes, Sequelize } from "sequelize";
import { validateEnvVars, type DbTestResult } from "./db_utils";
import { EncounterType } from "@/models/enums/EncounterType";
import { Rarity } from "@/models/enums/Rarity";
import { Role } from "@/models/enums";

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
            console.error("Unable to connect to the database:", error);
            process.exit(1);
        }

        // Guild table
        const guild = this.sequelize.define("Guilds", {
            guildId: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            guildTag: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            level: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
        });

        // GuildMember table
        const guildMember = this.sequelize.define(
            "GuildMembers",
            {
                userId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true,
                },
                role: {
                    type: DataTypes.ENUM(...Object.values(Role)),
                    allowNull: false,
                },
                level: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                lastActivityOn: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },
                guildId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    references: {
                        model: "Guilds",
                        key: "guildId",
                    },
                },
            },
            {
                indexes: [
                    {
                        fields: ["guildId"],
                    },
                ],
            }
        );

        // GuldRaidSeason table
        const guildRaidSeason = this.sequelize.define("GuildRaidSeasons", {
            guildRaidSeasonId: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            season: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            guildId: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: "Guilds",
                    key: "guildId",
                },
            },
            seasonConfigId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        });

        // Raid table
        const raid = this.sequelize.define(
            "Raids",
            {
                id: {
                    type: DataTypes.UUID,
                    defaultValue: DataTypes.UUIDV4,
                    primaryKey: true,
                },
                userId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                tier: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                set: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                encounterIndex: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                remainingHp: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                maxHp: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                encounterType: {
                    type: DataTypes.ENUM(...Object.values(EncounterType)),
                    allowNull: false,
                },
                unitId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                type: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                rarity: {
                    type: DataTypes.ENUM(...Object.values(Rarity)),
                    allowNull: false,
                },
                damageDealt: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                damageType: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                startedOn: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
                completedOn: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },
                globalConfigHash: {
                    type: DataTypes.STRING,
                    allowNull: false,
                },
                seasonId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: "GuildRaidSeasons",
                        key: "guildRaidSeasonId",
                    },
                },
            },
            {
                indexes: [
                    {
                        fields: ["seasonId"],
                    },
                ],
            }
        );

        // PublicHeroDetail table - This table is used to store hero details (toons)
        const publicHeroDetail = this.sequelize.define(
            "PublicHeroDetail",
            {
                unitId: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true,
                },
                power: {
                    type: DataTypes.INTEGER,
                    allowNull: false,
                },
                raidId: {
                    type: DataTypes.UUID,
                    allowNull: false,
                    references: {
                        model: "Raids",
                        key: "id",
                    },
                },
            },
            {
                indexes: [
                    {
                        fields: ["raidId"],
                    },
                ],
            }
        );

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
        guild.hasMany(guildMember, { foreignKey: "guildId" });
        guildMember.belongsTo(guild, { foreignKey: "guildId" });

        guildRaidSeason.hasMany(raid, { foreignKey: "seasonId" });
        raid.belongsTo(guildRaidSeason, { foreignKey: "seasonId" });

        guild.hasMany(guildRaidSeason, { foreignKey: "guildId" });
        guildRaidSeason.belongsTo(guild, { foreignKey: "guildId" });

        raid.hasMany(publicHeroDetail, { foreignKey: "raidId" });
        publicHeroDetail.belongsTo(raid, { foreignKey: "raidId" });

        this.sequelize.sync({});
    }

    public async isReady(): Promise<DbTestResult> {
        try {
            await this.sequelize.authenticate();
            console.log("Database is ready for use");
        } catch (error) {
            console.error("Unable to connect to the database:", error);
            return {
                isSuccess: false,
                message: "Unable to connect to the database.",
            } as DbTestResult;
        }

        return { isSuccess: true } as DbTestResult;
    }

    public async registerUser(userId: string, token: string): Promise<boolean> {
        try {
            await this.sequelize.models["discordApiTokenMappings"]?.create({
                userId: userId,
                token: token,
            });

            return true;
        } catch (error) {
            console.error("Error storing registered user to database:", error);
            return false;
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
            console.error("Error retrieving user token from database:", error);
            return null;
        }
    }
}

export const dbController = new DatabaseController();
