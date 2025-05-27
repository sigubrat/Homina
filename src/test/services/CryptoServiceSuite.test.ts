import { CryptoService } from "@/lib/services/CryptoService";
import { describe, expect, test, beforeEach, afterEach } from "bun:test";

const VALID_KEY = "a".repeat(64); // 32 bytes in hex
const INVALID_KEY = "b".repeat(10);

describe("CryptoService", () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.ENCRYPTION_KEY = VALID_KEY;
        process.env.OLD_ENCRYPTION_KEY = VALID_KEY;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test("encrypt should return iv:encrypted format", () => {
        const text = "hello world";
        const encrypted = CryptoService.encrypt(text);
        expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    });

    test("decrypt should return original text", () => {
        const text = "test string";
        const encrypted = CryptoService.encrypt(text);
        const decrypted = CryptoService.decrypt(encrypted);
        expect(decrypted).toBe(text);
    });

    test("decrypt should throw on invalid format", () => {
        expect(() => CryptoService.decrypt("invalidformat")).toThrow(
            "Invalid encrypted text format"
        );
    });

    test("getEncryptionKey returns valid key", () => {
        expect(CryptoService.getEncryptionKey()).toBe(VALID_KEY);
    });

    test("getEncryptionKey throws if key missing", () => {
        delete process.env.ENCRYPTION_KEY;
        expect(() => CryptoService.getEncryptionKey()).toThrow(
            "ENCRYPTION_KEY must be set"
        );
    });

    test("getEncryptionKey throws if key invalid length", () => {
        process.env.ENCRYPTION_KEY = INVALID_KEY;
        expect(() => CryptoService.getEncryptionKey()).toThrow(
            "ENCRYPTION_KEY must be set"
        );
    });

    test("getOldEncryptionKey returns valid key", () => {
        expect(CryptoService.getOldEncryptionKey()).toBe(VALID_KEY);
    });

    test("getOldEncryptionKey throws if key missing", () => {
        delete process.env.OLD_ENCRYPTION_KEY;
        expect(() => CryptoService.getOldEncryptionKey()).toThrow(
            "OLD_ENCRYPTION_KEY must be set"
        );
    });

    test("getOldEncryptionKey throws if key invalid length", () => {
        process.env.OLD_ENCRYPTION_KEY = INVALID_KEY;
        expect(() => CryptoService.getOldEncryptionKey()).toThrow(
            "OLD_ENCRYPTION_KEY must be set"
        );
    });
});
