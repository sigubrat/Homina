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
    logging: true,
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

const test = sequelize.define("test", {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    value: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
});

test.sync({ force: true });
