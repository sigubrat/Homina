import { Sequelize, DataTypes } from "sequelize";
import { validateEnvVars } from "../db_utils";
import { EncounterType } from "../../models/enums/EncounterType";
import { Rarity } from "../../models/enums/Rarity";
import { Role } from "@/models/enums";

validateEnvVars(["DB_NAME", "DB_USER", "DB_PWD"]);

const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPwd = process.env.DB_PWD;

const sequelize = new Sequelize(dbName!, dbUser!, dbPwd, {
    host: "localhost",
    dialect: "postgres",
    logging: () => {
        return true;
    },
});

try {
    await sequelize.authenticate();
    console.log(
        "Connection to the database has been established successfully."
    );
} catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
}

// Guild table
const guild = sequelize.define("Guilds", {
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
const guildMember = sequelize.define(
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
const guildRaidSeason = sequelize.define("GuildRaidSeasons", {
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
const raid = sequelize.define(
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
const publicHeroDetail = sequelize.define(
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

// Use force for development, alter in production
// Note: This will drop the tables if they exist and recreate them
try {
    await sequelize.sync({ force: true, logging: console.log });
    console.log("Database tables created successfully.");
    process.exit(0);
} catch (error) {
    console.error("Error creating database tables:", error);
    process.exit(1);
}
