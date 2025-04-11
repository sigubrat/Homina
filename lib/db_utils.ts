import { Sequelize } from "sequelize";

export interface DbTestResult {
    isSuccess: boolean;
    message?: string;
}

export async function isDbReady(): Promise<DbTestResult> {
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
        return {
            isSuccess: false,
            message: `Missing environment variables: ${missingVars.join(
                ", "
            )}. Please ensure all required variables are set.`,
        } as DbTestResult;
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
        return {
            isSuccess: false,
            message: "Unable to connect to the database.",
        } as DbTestResult;
    }

    return { isSuccess: true } as DbTestResult;
}
