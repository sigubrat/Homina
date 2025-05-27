import { validateEnvVars } from "@/lib";
import { CryptoService } from "@/lib/services/CryptoService";
import { DataTypes, Sequelize } from "sequelize";

const sequelize = new Sequelize(
    process.env.DB_NAME!,
    process.env.DB_USER!,
    process.env.DB_PWD!,
    {
        host: "localhost",
        dialect: "postgres",
        logging: false,
    }
);

validateEnvVars([
    "OLD_ENCRYPTION_KEY",
    "ENCRYPTION_KEY",
    "DB_NAME",
    "DB_USER",
    "DB_PWD",
]);

const OLD_KEY = CryptoService.getOldEncryptionKey();
const NEW_KEY = CryptoService.getEncryptionKey();

async function migrate() {
    const TokenModel = sequelize.define("discordApiTokenMappings", {
        userId: { type: DataTypes.STRING, primaryKey: true },
        token: { type: DataTypes.STRING },
    });

    await sequelize.authenticate();
    const rows = await TokenModel.findAll();

    for (const row of rows) {
        const token = row.getDataValue("token");
        if (typeof token === "string" && token.includes(":")) {
            const decrypted = CryptoService.decrypt(token, OLD_KEY);
            const reEncrypted = CryptoService.encrypt(decrypted, NEW_KEY);
            row.setDataValue("token", reEncrypted);
            await row.save();
        }
    }
    await sequelize.close();
    console.log("Re-encryption complete.");
}

migrate().catch(console.error);
