import { ChartService } from "@/lib/services/ChartService";
import { GuildRaidResultFixture } from "../testFixtures";
import { describe, expect, test } from "bun:test";

const chartService = new ChartService();
const testData = GuildRaidResultFixture;

describe("ChartServiceSuite - Algebra", () => {
    test("CreateSeasonDamageChart - Should create a chart", async () => {
        const result = await chartService.createSeasonDamageChart(
            testData,
            "Test",
            true,
            "mean",
            12,
        );

        expect(result).toBeDefined();
        expect(result.byteLength).toBeGreaterThan(0);
    });
});

describe("ChartServiceSuite - createCommandUsageChart", () => {
    test("Should return null when data is empty", async () => {
        const result = await chartService.createCommandUsageChart({}, "Empty");
        expect(result).toBeNull();
    });

    test("Should return a non-empty buffer for valid multi-command data", async () => {
        const data = {
            "season-bosses": [
                { date: "2026-02-27", count: 5 },
                { date: "2026-02-28", count: 8 },
                { date: "2026-03-01", count: 3 },
            ],
            register: [
                { date: "2026-02-27", count: 2 },
                { date: "2026-03-01", count: 1 },
            ],
        };

        const result = await chartService.createCommandUsageChart(
            data,
            "Command Usage Test",
        );

        expect(result).not.toBeNull();
        expect(result!.byteLength).toBeGreaterThan(0);
    });
});
