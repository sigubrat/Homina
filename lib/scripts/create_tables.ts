import { Sequelize, DataTypes } from "sequelize";

const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPwd = process.env.DB_PWD;

const missingVars = [];

if (!dbName) missingVars.push("DB_NAME");
if (!dbUser) missingVars.push("DB_USER");
if (!dbPwd) missingVars.push("DB_PWD");

if (missingVars.length > 0) {
    console.error(
        `Missing environment variables: ${missingVars.join(
            ", "
        )}. Please ensure all required variables are set.`
    );
    process.exit(1);
}

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

// GuildMember table
sequelize.define("GuildMember", {
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    role: {
        type: DataTypes.ENUM("MEMBER", "OFFICER", "CO_LEADER", "LEADER"),
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
    guild: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: "Guild",
            key: "guildId",
        },
    },
});

// Guild table
sequelize.define("Guild", {
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

// Raid table
sequelize.define("Raid", {
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
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
        type: DataTypes.ENUM("SideBoss", "Boss"),
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
        type: DataTypes.ENUM("Common", "Uncommon", "Rare", "Epic", "Legendary"),
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
    heroDetails: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        // Todo: Add foreign key constraint to publicHeroDetail table
    },
    machineOfWarDetails: {
        type: DataTypes.STRING,
        allowNull: true,
        // Todo add foreign key constraint to publicHeroDetail
    },
    globalConfigHash: {
        type: DataTypes.STRING,
        allowNull: false,
    },
});

// PublicHeroDetail table - This table is used to store hero details (toons)
sequelize.define("PublicHeroDetail", {
    unitId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    power: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

// GuldRaidSeason table
sequelize.define("GuildRaidSeason", {
    season: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
    },
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: "Guild",
            key: "guildId",
        },
        primaryKey: true,
    },
    seasonConfigId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    entries: {
        type: DataTypes.ARRAY(),
    },
});

sequelize.sync({ force: true });
