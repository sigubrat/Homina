import {
    getUnixTimestamp,
    evaluateToken,
    SecondsToString,
    withinNextHour,
    calculateCurrentSeason,
    isInvalidSeason,
} from "@/lib/utils/timeUtils";
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

    test("calculateCurrentSeason - should return 85 for dates within the first 14 days", () => {
        const day1 = new Date(2025, 9, 9, 10, 0, 0);
        const day7 = new Date(2025, 9, 15, 10, 0, 0);
        const day13 = new Date(2025, 9, 21, 10, 0, 0);

        expect(calculateCurrentSeason(day1)).toBe(85);
        expect(calculateCurrentSeason(day7)).toBe(85);
        expect(calculateCurrentSeason(day13)).toBe(85);
    });

    test("calculateCurrentSeason - should return 86 on day 14 (start of season 86)", () => {
        const season86Start = new Date(2025, 9, 22, 10, 0, 0);
        expect(calculateCurrentSeason(season86Start)).toBe(86);
    });

    test("calculateCurrentSeason - should return 87 on day 28 (start of season 87)", () => {
        const season87Start = new Date(2025, 10, 5, 10, 0, 0);
        expect(calculateCurrentSeason(season87Start)).toBe(87);
    });

    test("calculateCurrentSeason - should return 88 on day 42 (start of season 88)", () => {
        const season88Start = new Date(2025, 10, 19, 10, 0, 0);
        expect(calculateCurrentSeason(season88Start)).toBe(88);
    });

    test("calculateCurrentSeason - should handle dates far in the future", () => {
        // 100 days = 7 complete seasons (7 * 14 = 98 days)
        const futureDate = new Date(2026, 0, 16, 10, 0, 0);
        expect(calculateCurrentSeason(futureDate)).toBe(92); // 85 + 7
    });

    test("calculateCurrentSeason - should return 85 for dates just before the next season starts", () => {
        const lastDayOfSeason85 = new Date(2025, 9, 22, 9, 59, 59);
        expect(calculateCurrentSeason(lastDayOfSeason85)).toBe(85);
    });

    test("isInvalidSeason - should return true for null season", () => {
        expect(isInvalidSeason(null)).toBe(true);
    });

    test("isInvalidSeason - should return true for non-integer values", () => {
        expect(isInvalidSeason(85.5)).toBe(true);
        expect(isInvalidSeason(90.99)).toBe(true);
    });

    test("isInvalidSeason - should return true for seasons below minimum threshold", () => {
        expect(isInvalidSeason(69)).toBe(true);
        expect(isInvalidSeason(50)).toBe(true);
        expect(isInvalidSeason(1)).toBe(true);
    });

    test("isInvalidSeason - should return true for seasons in the future", () => {
        const currentSeason = calculateCurrentSeason(new Date());
        expect(isInvalidSeason(currentSeason + 1)).toBe(true);
        expect(isInvalidSeason(currentSeason + 10)).toBe(true);
        expect(isInvalidSeason(999)).toBe(true);
    });

    test("isInvalidSeason - should return false for valid seasons", () => {
        expect(isInvalidSeason(70)).toBe(false); // Minimum threshold
        expect(isInvalidSeason(85)).toBe(false);
    });

    test("isInvalidSeason - should return false for the current season", () => {
        const currentSeason = calculateCurrentSeason(new Date());
        expect(isInvalidSeason(currentSeason)).toBe(false);
    });

    test("isInvalidSeason - should return true for negative numbers", () => {
        expect(isInvalidSeason(-1)).toBe(true);
        expect(isInvalidSeason(-85)).toBe(true);
    });

    test("isInvalidSeason - should return true for zero", () => {
        expect(isInvalidSeason(0)).toBe(true);
    });
});
