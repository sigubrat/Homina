import * as crypto from "crypto";
import { validateEnvVars } from "../db_utils";

export class CryptoService {
    static encrypt(text: string, key = getEncryptionKey()): string {
        validateEnvVars(["ENCRYPTION_KEY"]);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
            "aes-256-cbc",
            Buffer.from(key, "hex"),
            iv
        );
        let encrypted = cipher.update(text, "utf8", "base64");
        encrypted += cipher.final("base64");
        return iv.toString("base64") + ":" + encrypted;
    }

    static decrypt(text: string, key = getEncryptionKey()): string {
        const [iv, encrypted] = text.split(":");
        if (!iv || !encrypted) {
            throw new Error("Invalid encrypted text format");
        }
        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            Buffer.from(key, "hex"),
            Buffer.from(iv, "base64")
        );
        let decrypted = decipher.update(encrypted, "base64", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    }
}

function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || Buffer.from(key, "hex").length !== 32) {
        throw new Error(
            "ENCRYPTION_KEY must be set and must be 32 characters long."
        );
    }
    return key;
}

export function getOldEncryptionKey(): string {
    const key = process.env.OLD_ENCRYPTION_KEY;
    if (!key || Buffer.from(key, "hex").length !== 32) {
        throw new Error(
            "OLD_ENCRYPTION_KEY must be set and must be 32 characters long."
        );
    }
    return key;
}
