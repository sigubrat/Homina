import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { describe, expect, test } from "bun:test";
import { createMockClient } from "../mocks/mockTacticusClient";
import { createMockDb } from "../mocks/mockDbController";
import { RaidResultFixture } from "../testFixtures";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { Raid } from "@/models/types";

describe("RaidAnalyticsServiceSuite", () => {
    describe("getGuildRaidResultBySeason", () => {
        test("should return null when no API key is found", async () => {
            const mockDb = createMockDb({
                getUserToken: async () => null,
            });
            const service = new RaidAnalyticsService(
                createMockClient(),
                mockDb,
            );
            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
            );
            expect(result).toBeNull();
        });

        test("should return empty array when API returns no entries", async () => {
            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries: [],
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );
            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
            );
            expect(result).toEqual([]);
        });

        test("should aggregate damage per user correctly", async () => {
            const entries: Raid[] = [
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 4000000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 500000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1000,
                    completedOn: 1100,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 3500000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 300000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1200,
                    completedOn: 1300,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
                {
                    userId: "player-b",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 3200000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 200000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1400,
                    completedOn: 1500,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
            ];

            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries,
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );

            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
            );

            expect(result).not.toBeNull();
            expect(result!.length).toBe(2);

            const playerA = result!.find((r) => r.username === "player-a");
            expect(playerA).toBeDefined();
            expect(playerA!.totalDamage).toBe(800000);
            expect(playerA!.totalTokens).toBe(2);
            expect(playerA!.maxDmg).toBe(500000);
            expect(playerA!.minDmg).toBe(300000);
            expect(playerA!.bombCount).toBe(0);

            const playerB = result!.find((r) => r.username === "player-b");
            expect(playerB).toBeDefined();
            expect(playerB!.totalDamage).toBe(200000);
            expect(playerB!.totalTokens).toBe(1);
        });

        test("should count bombs without adding damage or tokens", async () => {
            const entries: Raid[] = [
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 4900000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 100000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1000,
                    completedOn: 1100,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 4890000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 10000,
                    damageType: DamageType.BOMB,
                    startedOn: 1200,
                    completedOn: 1200,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
            ];

            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries,
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );

            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
            );

            expect(result).not.toBeNull();
            const playerA = result!.find((r) => r.username === "player-a");
            expect(playerA!.totalDamage).toBe(100000);
            expect(playerA!.totalTokens).toBe(1);
            expect(playerA!.bombCount).toBe(1);
        });

        test("should filter by rarity when specified", async () => {
            const entries: Raid[] = [
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 0,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "LegBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 500000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1000,
                    completedOn: 1100,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
                {
                    userId: "player-a",
                    tier: 5,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 0,
                    maxHp: 10000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss2",
                    type: "MythBoss",
                    rarity: Rarity.MYTHIC,
                    damageDealt: 800000,
                    damageType: DamageType.BATTLE,
                    startedOn: 2000,
                    completedOn: 2100,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
            ];

            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries,
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );

            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
                Rarity.MYTHIC,
            );

            expect(result).not.toBeNull();
            expect(result!.length).toBe(1);
            expect(result![0]!.totalDamage).toBe(800000);
        });

        test("should exclude primes when includePrimes is false", async () => {
            const entries: Raid[] = [
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 4000000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 500000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1000,
                    completedOn: 1100,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 1,
                    remainingHp: 200000,
                    maxHp: 300000,
                    encounterType: EncounterType.SIDE_BOSS,
                    unitId: "prime1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 100000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1200,
                    completedOn: 1300,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
            ];

            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries,
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );

            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
                undefined,
                false,
            );

            expect(result).not.toBeNull();
            const playerA = result!.find((r) => r.username === "player-a");
            expect(playerA!.totalDamage).toBe(500000);
            expect(playerA!.totalTokens).toBe(1);
        });

        test("should track primeDamage separately", async () => {
            const entries: Raid[] = [
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 0,
                    remainingHp: 4000000,
                    maxHp: 5000000,
                    encounterType: EncounterType.BOSS,
                    unitId: "boss1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 500000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1000,
                    completedOn: 1100,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
                {
                    userId: "player-a",
                    tier: 4,
                    set: 0,
                    encounterIndex: 1,
                    remainingHp: 200000,
                    maxHp: 300000,
                    encounterType: EncounterType.SIDE_BOSS,
                    unitId: "prime1",
                    type: "TestBoss",
                    rarity: Rarity.LEGENDARY,
                    damageDealt: 100000,
                    damageType: DamageType.BATTLE,
                    startedOn: 1200,
                    completedOn: 1300,
                    heroDetails: [],
                    machineOfWarDetails: null,
                    globalConfigHash: "hash",
                },
            ];

            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries,
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );

            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
                undefined,
                true,
            );

            expect(result).not.toBeNull();
            const playerA = result!.find((r) => r.username === "player-a");
            expect(playerA!.totalDamage).toBe(600000);
            expect(playerA!.primeDamage).toBe(100000);
        });

        test("should work with existing fixture data", async () => {
            const mockClient = createMockClient({
                getGuildRaidBySeason: async () => ({
                    season: 85,
                    seasonConfigId: "config_1",
                    entries: RaidResultFixture,
                }),
            });
            const service = new RaidAnalyticsService(
                mockClient,
                createMockDb(),
            );

            const result = await service.getGuildRaidResultBySeason(
                "user-1",
                85,
            );

            expect(result).not.toBeNull();
            expect(result!.length).toBeGreaterThan(0);

            // All entries should have non-negative damage and tokens
            for (const entry of result!) {
                expect(entry.totalDamage).toBeGreaterThanOrEqual(0);
                expect(entry.totalTokens).toBeGreaterThanOrEqual(0);
                expect(entry.bombCount).toBeGreaterThanOrEqual(0);
            }
        });
    });
});
