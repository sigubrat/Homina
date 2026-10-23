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
            "Member,Damage,Tokens,Avg,Max,Min," +
                "Multihit use,Admech use,Neuro use,Custodes use,Battlesuit use,Lavstodes use,Other use," +
                "Multihit dmg,Admech dmg,Neuro dmg,Custodes dmg,Battlesuit dmg,Lavstodes dmg,Other dmg"
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

    it("should include every meta team in the row, in header order", async () => {
        const member = MemberStatsPerSeasonFixture[0]!;
        const buffer = await csvService.createMemberStats([member]);
        const lines = buffer.toString("utf-8").trim().split("\n");
        const header = lines[0]!.split(",");
        const row = lines[1]!.split(",");
        expect(row.length).toBe(header.length);

        const value = (column: string) => row[header.indexOf(column)];
        expect(value("Custodes use")).toBe("1");
        expect(value("Battlesuit use")).toBe("1");
        expect(value("Lavstodes use")).toBe("1");
        expect(value("Custodes dmg")).toBe("1500");
        expect(value("Battlesuit dmg")).toBe("2500");
        expect(value("Lavstodes dmg")).toBe("3500");
    });

    it("should default missing damage values to 0", async () => {
        const member = MemberStatsPerSeasonFixture[1]!;
        const buffer = await csvService.createMemberStats([member]);
        const lines = buffer.toString("utf-8").trim().split("\n");
        const header = lines[0]!.split(",");
        const row = lines[1]!.split(",");
        expect(row[header.indexOf("Lavstodes dmg")]).toBe("0");
        expect(lines[1]).not.toContain("undefined");
    });
});
