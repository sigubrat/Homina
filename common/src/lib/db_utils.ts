import { Sequelize } from "sequelize";

export interface DbTestResult {
    isSuccess: boolean;
    message?: string;
}

export function validateEnvVars(requiredVars: string[]): void {
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error(
            `Missing environment variables: ${missingVars.join(
                ", "
            )}. Please ensure all required variables are set.`
        );
        process.exit(1);
    }
}

export async function isDbReady(): Promise<DbTestResult> {
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
        return {
            isSuccess: false,
            message: "Unable to connect to the database.",
        } as DbTestResult;
    }

    return { isSuccess: true } as DbTestResult;
}
