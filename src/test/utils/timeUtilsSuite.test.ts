import {
    getUnixTimestamp,
    evaluateToken,
    SecondsToString,
    withinNextHour,
} from "@/lib/utils/timeUtilts";
import { describe, expect, test } from "bun:test";

describe("timeUtilsSuite - Algebra", () => {
    test("getUnixTimestamp - Should return the correct unix timestamp", () => {
        const date = new Date("2023-10-01T00:00:00Z");
        const timestamp = getUnixTimestamp(date);
        expect(timestamp).toBe(1696118400);
    });

    test("evaluateToken - Should evaluate the token correctly", () => {
        const token = {
            count: 1,
            refreshTime: 1696118400,
        };
        // 13 hour later
        const timestampInSeconds = 1696168800;
        const evaluatedToken = evaluateToken(token, timestampInSeconds);
        expect(evaluatedToken.count).toBe(2);
        expect(evaluatedToken.refreshTime).toBe(1696161600);
    });

    test("timestampInSecondsToString - Should convert timestamp to string correctly", () => {
        const timestampInSeconds = 86400 + 3600 + 60 + 1; // 1 day, 1 hour, 1 minute, and 1 second
        const result = SecondsToString(timestampInSeconds);
        expect(result).toBe("1d 01h 01m 01s");
    });

    test("timestampInSecondsToString - Should handle hiding days parameter correctly", () => {
        const timestampInSeconds = 86400 + 3600 + 60 + 1; // 1 day, 1 hour, 1 minute, and 1 second
        const result = SecondsToString(timestampInSeconds, true);
        expect(result).toBe("25h 01m 01s");
    });

    test("withinNextHour - Should return true for cooldowns within the next hour", () => {
        expect(withinNextHour("00h30m")).toBe(true);
        expect(withinNextHour("00h32m")).toBe(true);
        expect(withinNextHour("00h00m")).toBe(true);
    });

    test("withinNextHour - Should return false for cooldowns outside the next hour", () => {
        expect(withinNextHour("01h01m")).toBe(false);
        expect(withinNextHour("02h00m")).toBe(false);
    });
});
