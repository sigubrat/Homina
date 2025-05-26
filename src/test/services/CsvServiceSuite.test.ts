import { CsvService } from "@/lib/services/CsvService";
import { MemberStatsPerSeasonFixture } from "../testFixtures";
import { describe, it, expect, beforeEach } from "bun:test";

describe("CsvService", () => {
    let csvService: CsvService;

    beforeEach(() => {
        csvService = new CsvService();
    });

    it("should generate a CSV buffer with correct headers and data rows", async () => {
        const buffer = await csvService.createMemberStats(
            MemberStatsPerSeasonFixture
        );
        const csv = buffer.toString("utf-8");
        const lines = csv.trim().split("\n");
        // Check header
        expect(lines[0]).toBe(
            "Member,Damage,Tokens, Avg,Max,Min,Multihit use, Mech use,Neuro use,Other use,MultiHit dmg,Mech dmg,Neuro dmg,Other dmg"
        );
        // Check row count (header + data)
        expect(lines.length).toBe(MemberStatsPerSeasonFixture.length + 1);
        // Check a sample row
        expect(lines[1]).toContain("Alpha");
        expect(lines[2]).toContain("Bravo");
    });

    it("should handle missing username and zero tokens gracefully", async () => {
        const member = MemberStatsPerSeasonFixture[2]!;
        const buffer = await csvService.createMemberStats([member]);
        const csv = buffer.toString("utf-8");
        expect(csv).toContain('"Unknown"');
        // Avg should be 0.00 (0/1)
        expect(csv).toContain(",0.00,");
    });

    it("should output correct averages and formatting", async () => {
        const member = MemberStatsPerSeasonFixture[0]!;
        const buffer = await csvService.createMemberStats([member]);
        const csv = buffer.toString("utf-8");
        // 10000 / 5 = 2000.00
        expect(csv).toContain(",2000.00,");
    });
});
