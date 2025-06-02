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
            "average",
            12
        );

        expect(result).toBeDefined();
        expect(result.byteLength).toBeGreaterThan(0);
    });
});
