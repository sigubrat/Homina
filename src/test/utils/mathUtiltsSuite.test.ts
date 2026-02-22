import {
    formatDelta,
    getTopNDamageDealers,
    isValidUUIDv4,
    numericAverage,
    numericMedian,
    sortGuildRaidResultDesc,
    sortTokensUsed,
    standardDeviation,
} from "@/lib/utils/mathUtils";
import { shortenNumber } from "@/lib/utils/utils";
import type { GuildRaidResult } from "@/models/types";
import { describe, expect, test } from "bun:test";

describe("mathUtilsSuite - Algebra", () => {
    test("getTopNDamageDealers - Should return the top N damage dealers", () => {
        const sortedData: GuildRaidResult[] = [
            {
                username: "Player1",
                totalDamage: 1000,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
            {
                username: "Player2",
                totalDamage: 800,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
            {
                username: "Player3",
                totalDamage: 600,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                bombCount: 0,
                startedOn: 0,
            },
        ];
        const n = 2;
        const result = getTopNDamageDealers(sortedData, n);
        expect(result).toEqual([
            `🥇 Player1: ${Number(1000).toLocaleString()}`,
            "🥈 Player2: 800",
        ]);
    });

    test("sortGuildRaidResultDesc - Should sort the guild raid result in descending order", () => {
        const data: GuildRaidResult[] = [
            {
                username: "Player2",
                totalDamage: 800,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
            {
                username: "Player1",
                totalDamage: 1000,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
            {
                username: "Player3",
                totalDamage: 600,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
        ];
        const result = sortGuildRaidResultDesc(data);
        expect(result[0]!.username).toBe("Player1");
        expect(result[1]!.username).toBe("Player2");
        expect(result[2]!.username).toBe("Player3");
    });

    test("sortTokensUsed - Should sort the tokens used in descending order", () => {
        const data = [
            { username: "Test1", boss: "Boss1", tokens: 5 },
            { username: "Test2", boss: "Boss2", tokens: 10 },
            { username: "Test3", boss: "Boss3", tokens: 7 },
        ];
        const result = sortTokensUsed(data);
        expect(result[0]!.tokens).toBe(10);
        expect(result[1]!.tokens).toBe(7);
        expect(result[2]!.tokens).toBe(5);
        expect(result[0]!.username).toBe("Test2");
        expect(result[1]!.username).toBe("Test3");
        expect(result[2]!.username).toBe("Test1");
    });

    test("isValidUUIDv4 - validates correct and incorrect UUIDs", () => {
        expect(isValidUUIDv4("123e4567-e89b-12d3-a456-426614174000")).toBe(
            false,
        ); // not v4
        expect(isValidUUIDv4("123e4567-e89b-42d3-a456-426614174000")).toBe(
            true,
        ); // valid v4
        expect(isValidUUIDv4("invalid-uuid")).toBe(false);
    });

    test("numericAverage - returns correct average for non-empty array", () => {
        expect(numericAverage([1, 2, 3, 4, 5])).toBe(3);
        expect(numericAverage([10, 20])).toBe(15);
    });
    test("numericAverage - returns 0 for empty array", () => {
        expect(numericAverage([])).toBe(0);
    });

    test("standardDeviation - returns correct stddev for array", () => {
        expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
        expect(standardDeviation([1, 1, 1, 1])).toBe(0);
    });
    test("standardDeviation - returns 0 for empty array", () => {
        expect(standardDeviation([])).toBe(0);
    });

    test("numericMedian - returns correct median for odd/even arrays", () => {
        expect(numericMedian([1, 2, 3, 4, 5])).toBe(3);
        expect(numericMedian([1, 2, 3, 4])).toBe(2.5);
    });

    test("numericMedian - returns 0 for empty array", () => {
        expect(numericMedian([])).toBe(0);
    });

    test("shortenNumber - Should shorten numbers correctly", () => {
        expect(shortenNumber(999)).toBe("999");
        expect(shortenNumber(1000)).toBe("1.0K");
        expect(shortenNumber(1500)).toBe("1.5K");
        expect(shortenNumber(1000000)).toBe("1.0M");
        expect(shortenNumber(2500000)).toBe("2.5M");
        expect(shortenNumber(1000000000)).toBe("1.0B");
        expect(shortenNumber(15000000000)).toBe("15.0B");
    });

    test("formatDelta - Should format values above 100 with + prefix", () => {
        expect(formatDelta(102.3)).toBe("+2.3%");
        expect(formatDelta(120)).toBe("+20.0%");
        expect(formatDelta(150.55)).toBe("+50.6%");
    });

    test("formatDelta - Should format values below 100 with - prefix", () => {
        expect(formatDelta(95)).toBe("-5.0%");
        expect(formatDelta(80.4)).toBe("-19.6%");
        expect(formatDelta(0)).toBe("-100.0%");
    });

    test("formatDelta - Should format exactly 100 as +0.0%", () => {
        expect(formatDelta(100)).toBe("+0.0%");
    });
});
