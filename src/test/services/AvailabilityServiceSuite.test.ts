import { AvailabilityService } from "@/lib/services/AvailabilityService";
import { describe, expect, test } from "bun:test";
import { createMockClient } from "../mocks/mockTacticusClient";
import { createMockDb } from "../mocks/mockDbController";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { Raid } from "@/models/types";

function makeRaid(overrides: Partial<Raid> & { startedOn: number }): Raid {
    return {
        userId: "player-1",
        tier: 4,
        set: 0,
        encounterIndex: 0,
        remainingHp: 1_000_000,
        maxHp: 5_000_000,
        encounterType: EncounterType.BOSS,
        unitId: "unit-boss",
        type: "TypeA",
        rarity: Rarity.LEGENDARY,
        damageDealt: 500_000,
        damageType: DamageType.BATTLE,
        completedOn: overrides.startedOn + 100,
        heroDetails: [],
        machineOfWarDetails: null,
        globalConfigHash: "hash",
        ...overrides,
    };
}

describe("AvailabilityServiceSuite - getCurrentBossUnits", () => {
    test("returns null when no API key is found", async () => {
        const service = new AvailabilityService(
            createMockClient(),
            createMockDb({ getUserToken: async () => null }),
        );
        expect(await service.getCurrentBossUnits("user-1")).toBeNull();
    });

    test("returns null when the API returns no entries", async () => {
        const service = new AvailabilityService(
            createMockClient({
                getGuildRaidByCurrentSeason: async () => ({
                    season: 85,
                    seasonConfigId: "cfg",
                    entries: [],
                }),
            }),
            createMockDb(),
        );
        expect(await service.getCurrentBossUnits("user-1")).toBeNull();
    });

    test("returns one entry per unitId for the most recent type", async () => {
        const entries: Raid[] = [
            makeRaid({
                unitId: "boss-1",
                type: "TypeA",
                encounterType: EncounterType.BOSS,
                remainingHp: 3_000_000,
                startedOn: 1000,
            }),
            makeRaid({
                unitId: "side-1",
                type: "TypeA",
                encounterType: EncounterType.SIDE_BOSS,
                remainingHp: 500_000,
                startedOn: 1100,
            }),
            makeRaid({
                unitId: "side-2",
                type: "TypeA",
                encounterType: EncounterType.SIDE_BOSS,
                remainingHp: 200_000,
                startedOn: 1050,
            }),
        ];

        const service = new AvailabilityService(
            createMockClient({
                getGuildRaidByCurrentSeason: async () => ({
                    season: 85,
                    seasonConfigId: "cfg",
                    entries,
                }),
            }),
            createMockDb(),
        );

        const result = await service.getCurrentBossUnits("user-1");
        expect(result).not.toBeNull();
        expect(result!.length).toBe(3);

        const boss = result!.find((u) => u.unitId === "boss-1");
        expect(boss?.remainingHp).toBe(3_000_000);
        expect(boss?.encounterType).toBe(EncounterType.BOSS);

        const side1 = result!.find((u) => u.unitId === "side-1");
        expect(side1?.remainingHp).toBe(500_000);
        expect(side1?.encounterType).toBe(EncounterType.SIDE_BOSS);
    });

    test("picks the most recent entry per unitId when there are multiple hits", async () => {
        // Two attacks on the same boss unit — only the later one should be used
        const entries: Raid[] = [
            makeRaid({
                unitId: "boss-1",
                type: "TypeA",
                encounterType: EncounterType.BOSS,
                remainingHp: 4_000_000,
                startedOn: 1000,
            }),
            makeRaid({
                unitId: "boss-1",
                type: "TypeA",
                encounterType: EncounterType.BOSS,
                remainingHp: 2_500_000,
                startedOn: 2000,
            }),
        ];

        const service = new AvailabilityService(
            createMockClient({
                getGuildRaidByCurrentSeason: async () => ({
                    season: 85,
                    seasonConfigId: "cfg",
                    entries,
                }),
            }),
            createMockDb(),
        );

        const result = await service.getCurrentBossUnits("user-1");
        expect(result).not.toBeNull();
        expect(result!.length).toBe(1);
        expect(result![0]!.remainingHp).toBe(2_500_000);
    });

    test("ignores entries from older boss types and uses only the most recent type", async () => {
        // TypeOld was fought earlier; TypeNew is the current boss
        const entries: Raid[] = [
            makeRaid({
                unitId: "old-boss",
                type: "TypeOld",
                encounterType: EncounterType.BOSS,
                remainingHp: 0,
                startedOn: 500,
            }),
            makeRaid({
                unitId: "new-boss",
                type: "TypeNew",
                encounterType: EncounterType.BOSS,
                remainingHp: 8_000_000,
                startedOn: 3000,
            }),
            makeRaid({
                unitId: "new-side",
                type: "TypeNew",
                encounterType: EncounterType.SIDE_BOSS,
                remainingHp: 1_000_000,
                startedOn: 2800,
            }),
        ];

        const service = new AvailabilityService(
            createMockClient({
                getGuildRaidByCurrentSeason: async () => ({
                    season: 85,
                    seasonConfigId: "cfg",
                    entries,
                }),
            }),
            createMockDb(),
        );

        const result = await service.getCurrentBossUnits("user-1");
        expect(result).not.toBeNull();
        expect(result!.length).toBe(2);
        expect(result!.every((u) => u.unitId !== "old-boss")).toBe(true);
        expect(result!.find((u) => u.unitId === "new-boss")?.remainingHp).toBe(
            8_000_000,
        );
    });

    test("returns correct encounterType for each unit", async () => {
        const entries: Raid[] = [
            makeRaid({
                unitId: "boss-1",
                type: "TypeA",
                encounterType: EncounterType.BOSS,
                remainingHp: 1_000_000,
                startedOn: 1000,
            }),
            makeRaid({
                unitId: "side-1",
                type: "TypeA",
                encounterType: EncounterType.SIDE_BOSS,
                remainingHp: 500_000,
                startedOn: 900,
            }),
        ];

        const service = new AvailabilityService(
            createMockClient({
                getGuildRaidByCurrentSeason: async () => ({
                    season: 85,
                    seasonConfigId: "cfg",
                    entries,
                }),
            }),
            createMockDb(),
        );

        const result = await service.getCurrentBossUnits("user-1");
        const bossUnit = result!.find((u) => u.unitId === "boss-1");
        const sideUnit = result!.find((u) => u.unitId === "side-1");

        expect(bossUnit?.encounterType).toBe(EncounterType.BOSS);
        expect(sideUnit?.encounterType).toBe(EncounterType.SIDE_BOSS);
    });
});
