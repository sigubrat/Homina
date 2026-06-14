import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { describe, expect, test } from "bun:test";
import { MenhirRaidResultFixture, RaidResultFixture } from "../testFixtures";
import type { Raid } from "@/models/types";
import { DamageType, EncounterType, Rarity } from "@/models/enums";

const dtsService = new DataTransformationService();
const testGuildRaidData = RaidResultFixture;

describe("DataTransformationServiceSuite - Algebra", () => {
    test("timeUsedPerBoss - Should properly transform guild raid data grouped by type with boss, prime, and total rows", () => {
        const result = dtsService.timeUsedPerBoss(testGuildRaidData);

        // All entries have type "Belisarius", tier 4 — one group, one loop
        expect(result.groups).toHaveLength(1);
        const group = result.groups[0]!;
        expect(group.type).toBe("Belisarius");
        expect(group.loops).toHaveLength(1);

        const loop = group.loops[0]!;
        expect(loop.loopIndex).toBe(1);
        expect(loop.rarityLabel).toBe("L1");

        // Boss row: 2 BOSS entries, startedOn 1750316881, completedOn 1750318958
        expect(loop.bossRow).not.toBeNull();
        expect(loop.bossRow!.kind).toBe("boss");
        expect(loop.bossRow!.tokens).toBe(2);
        expect(loop.bossRow!.bombs).toBe(0);
        expect(loop.bossRow!.time).toBe(2077); // completedOn - startedOn

        // Prime rows: 2 distinct unitIds
        expect(loop.primeRows).toHaveLength(2);

        // Total row: all 9 entries in the (Belisarius, tier=4) bucket
        expect(loop.totalRow.kind).toBe("total");
        expect(loop.totalRow.tokens).toBe(5);
        expect(loop.totalRow.bombs).toBe(4);
        // time = max(completedOn=1750318958) - min(startedOn=1750314154) = 4804
        expect(loop.totalRow.time).toBe(4804);

        expect(result.totalTime).toBe("00h 45m 27s");
    });

    test("timeUsedPerBoss - Should correctly handle the menhir twin ids across different types/tiers", () => {
        const result = dtsService.timeUsedPerBoss(MenhirRaidResultFixture);

        // Two types: "MagnusTheRed" and "SilentKing"
        expect(result.groups).toHaveLength(2);

        const magnusGroup = result.groups.find(
            (g) => g.type === "MagnusTheRed",
        )!;
        expect(magnusGroup.loops).toHaveLength(1);
        const magnusLoop = magnusGroup.loops[0]!;
        // Only SIDE_BOSS entries, no BOSS entry
        expect(magnusLoop.bossRow).toBeNull();
        expect(magnusLoop.primeRows).toHaveLength(1);
        expect(magnusLoop.primeRows[0]!.bombs).toBe(2);
        expect(magnusLoop.primeRows[0]!.tokens).toBe(0);
        expect(magnusLoop.primeRows[0]!.time).toBe(10);
        expect(magnusLoop.totalRow.time).toBe(10);

        const silentKingGroup = result.groups.find(
            (g) => g.type === "SilentKing",
        )!;
        expect(silentKingGroup.loops).toHaveLength(1);
        const skLoop = silentKingGroup.loops[0]!;
        expect(skLoop.bossRow).toBeNull();
        expect(skLoop.primeRows).toHaveLength(1);
        // 6 entries, all BOMB, startedOn range 60–70 => time = 10
        expect(skLoop.primeRows[0]!.bombs).toBe(6);
        expect(skLoop.primeRows[0]!.time).toBe(10);
        expect(skLoop.totalRow.time).toBe(10);

        // Total time: max(70) - min(0) = 70s
        expect(result.totalTime).toBe("00h 01m 10s");
    });

    test("timeUsedPerBoss - Should return empty result for empty input", () => {
        const result = dtsService.timeUsedPerBoss([]);
        expect(result.groups).toHaveLength(0);
        expect(result.totalTime).toBe("0s");
    });

    test("timeUsedPerBoss - Should calculate time as max(completedOn) - min(startedOn)", () => {
        const data: Raid[] = [
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 100000,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 200000,
                damageType: DamageType.BATTLE,
                startedOn: 100,
                completedOn: 300,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user2",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 0,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 100000,
                damageType: DamageType.BATTLE,
                startedOn: 200,
                completedOn: 500,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
        ];

        const result = dtsService.timeUsedPerBoss(data);
        const loop = result.groups[0]!.loops[0]!;

        // time = max(completedOn=500) - min(startedOn=100) = 400
        expect(loop.bossRow!.time).toBe(400);
        expect(loop.totalRow.time).toBe(400);
    });

    test("timeUsedPerBoss - Should calculate total time spanning sideboss to boss completion", () => {
        const data: Raid[] = [
            {
                userId: "user1",
                tier: 6,
                set: 0,
                encounterIndex: 1,
                remainingHp: 0,
                maxHp: 200000,
                encounterType: EncounterType.SIDE_BOSS,
                unitId: "PrimeUnit1",
                type: "Ghazghkull",
                rarity: Rarity.LEGENDARY,
                damageDealt: 200000,
                damageType: DamageType.BATTLE,
                startedOn: 0,
                completedOn: 600,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user1",
                tier: 6,
                set: 0,
                encounterIndex: 0,
                remainingHp: 300000,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "Ghazghkull",
                rarity: Rarity.LEGENDARY,
                damageDealt: 200000,
                damageType: DamageType.BATTLE,
                startedOn: 1000,
                completedOn: 2500,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user2",
                tier: 6,
                set: 0,
                encounterIndex: 0,
                remainingHp: 0,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "Ghazghkull",
                rarity: Rarity.LEGENDARY,
                damageDealt: 300000,
                damageType: DamageType.BATTLE,
                startedOn: 2000,
                completedOn: 3600,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
        ];

        const result = dtsService.timeUsedPerBoss(data);
        const loop = result.groups[0]!.loops[0]!;

        // Boss only: max(completedOn=3600) - min(startedOn=1000) = 2600
        expect(loop.bossRow!.time).toBe(2600);
        // Prime: max(completedOn=600) - min(startedOn=0) = 600
        expect(loop.primeRows[0]!.time).toBe(600);
        // Total: max(completedOn=3600) - min(startedOn=0) = 3600
        expect(loop.totalRow.time).toBe(3600);
    });

    test("timeUsedPerBoss - Should separate loops by tier for same boss type", () => {
        const data: Raid[] = [
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 0,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "RogalDorn",
                rarity: Rarity.LEGENDARY,
                damageDealt: 500000,
                damageType: DamageType.BATTLE,
                startedOn: 100,
                completedOn: 400,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user1",
                tier: 6,
                set: 0,
                encounterIndex: 0,
                remainingHp: 0,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "RogalDorn",
                rarity: Rarity.LEGENDARY,
                damageDealt: 500000,
                damageType: DamageType.BATTLE,
                startedOn: 1000,
                completedOn: 1800,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
        ];

        const result = dtsService.timeUsedPerBoss(data);
        expect(result.groups).toHaveLength(1);
        expect(result.groups[0]!.loops).toHaveLength(2);

        // Loop 1 (tier 4): 400 - 100 = 300
        expect(result.groups[0]!.loops[0]!.bossRow!.time).toBe(300);
        // Loop 2 (tier 6): 1800 - 1000 = 800
        expect(result.groups[0]!.loops[1]!.bossRow!.time).toBe(800);
    });

    test("timeUsedPerBoss - Should correctly count tokens vs bombs", () => {
        const data: Raid[] = [
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 300000,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 200000,
                damageType: DamageType.BATTLE,
                startedOn: 100,
                completedOn: 200,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user2",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 290000,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 10000,
                damageType: DamageType.BOMB,
                startedOn: 150,
                completedOn: 150,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user3",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 100000,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 190000,
                damageType: DamageType.BATTLE,
                startedOn: 200,
                completedOn: 400,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user4",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 80000,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 20000,
                damageType: DamageType.BOMB,
                startedOn: 250,
                completedOn: 250,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
        ];

        const result = dtsService.timeUsedPerBoss(data);
        const loop = result.groups[0]!.loops[0]!;

        expect(loop.bossRow!.tokens).toBe(2);
        expect(loop.bossRow!.bombs).toBe(2);
        // time = max(completedOn=400) - min(startedOn=100) = 300
        expect(loop.bossRow!.time).toBe(300);
    });

    test("timeUsedPerBoss - Should handle single attack where startedOn equals completedOn", () => {
        const data: Raid[] = [
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 0,
                maxHp: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 500000,
                damageType: DamageType.BOMB,
                startedOn: 1000,
                completedOn: 1000,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
        ];

        const result = dtsService.timeUsedPerBoss(data);
        const loop = result.groups[0]!.loops[0]!;

        // Single bomb kill: time should be 0
        expect(loop.bossRow!.time).toBe(0);
        expect(loop.totalRow.time).toBe(0);
    });

    test("timeUsedPerBoss - Should handle multiple sidebosses with different unitIds", () => {
        const data: Raid[] = [
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 1,
                remainingHp: 0,
                maxHp: 200000,
                encounterType: EncounterType.SIDE_BOSS,
                unitId: "Prime1",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 200000,
                damageType: DamageType.BATTLE,
                startedOn: 100,
                completedOn: 500,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 2,
                remainingHp: 0,
                maxHp: 200000,
                encounterType: EncounterType.SIDE_BOSS,
                unitId: "Prime2",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 200000,
                damageType: DamageType.BATTLE,
                startedOn: 600,
                completedOn: 900,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
            {
                userId: "user1",
                tier: 4,
                set: 0,
                encounterIndex: 0,
                remainingHp: 0,
                maxHp: 1000000,
                encounterType: EncounterType.BOSS,
                unitId: "BossUnit",
                type: "TestBoss",
                rarity: Rarity.LEGENDARY,
                damageDealt: 1000000,
                damageType: DamageType.BATTLE,
                startedOn: 1000,
                completedOn: 2000,
                heroDetails: [],
                machineOfWarDetails: null,
                globalConfigHash: "hash",
            },
        ];

        const result = dtsService.timeUsedPerBoss(data);
        const loop = result.groups[0]!.loops[0]!;

        // Prime1: 500 - 100 = 400
        expect(loop.primeRows).toHaveLength(2);
        const prime1 = loop.primeRows.find((p) => p.unitId === "Prime1")!;
        const prime2 = loop.primeRows.find((p) => p.unitId === "Prime2")!;
        expect(prime1.time).toBe(400);
        expect(prime2.time).toBe(300);

        // Boss: 2000 - 1000 = 1000
        expect(loop.bossRow!.time).toBe(1000);

        // Total: max(completedOn=2000) - min(startedOn=100) = 1900
        expect(loop.totalRow.time).toBe(1900);
    });

    const highscoreData: Raid[] = [
        {
            userId: "test1",
            tier: 4,
            set: 0,
            encounterIndex: 2,
            remainingHp: 154613,
            maxHp: 350000,
            encounterType: EncounterType.BOSS,
            unitId: "GuildBoss10MiniBoss2AdmecManipulus",
            type: "Belisarius",
            rarity: Rarity.LEGENDARY,
            damageDealt: 100,
            damageType: DamageType.BATTLE,
            startedOn: 1750314154,
            completedOn: 1750314243,
            heroDetails: [
                {
                    unitId: "ultraInceptorSgt",
                    power: 131325,
                },
                {
                    unitId: "eldarAutarch",
                    power: 326572,
                },
                {
                    unitId: "spaceBlackmane",
                    power: 194393,
                },
                {
                    unitId: "tauMarksman",
                    power: 206215,
                },
                {
                    unitId: "adeptCelestine",
                    power: 159721,
                },
            ],
            machineOfWarDetails: {
                unitId: "tyranBiovore",
                power: 5572,
            },
            globalConfigHash: "34e9c937e23efbb6e4a3eca6f45f7c4d",
        },
        {
            userId: "test1",
            tier: 4,
            set: 0,
            encounterIndex: 1,
            remainingHp: 241782,
            maxHp: 300000,
            encounterType: EncounterType.SIDE_BOSS,
            unitId: "GuildBoss10MiniBoss2AdmecManipulus",
            type: "Belisarius",
            rarity: Rarity.LEGENDARY,
            damageDealt: 200,
            damageType: DamageType.BATTLE,
            startedOn: 1750314392,
            completedOn: 1750314552,
            heroDetails: [
                {
                    unitId: "ultraInceptorSgt",
                    power: 111544,
                },
                {
                    unitId: "eldarAutarch",
                    power: 70290,
                },
                {
                    unitId: "spaceBlackmane",
                    power: 67740,
                },
                {
                    unitId: "orksRuntherd",
                    power: 78837,
                },
                {
                    unitId: "adeptMorvenn",
                    power: 188201,
                },
            ],
            machineOfWarDetails: {
                unitId: "blackForgefiend",
                power: 922,
            },
            globalConfigHash: "34e9c937e23efbb6e4a3eca6f45f7c4d",
        },
        {
            userId: "test2",
            tier: 4,
            set: 0,
            encounterIndex: 2,
            remainingHp: 143988,
            maxHp: 350000,
            encounterType: EncounterType.SIDE_BOSS,
            unitId: "GuildBoss10MiniBoss2AdmecManipulus",
            type: "Belisarius",
            rarity: Rarity.LEGENDARY,
            damageDealt: 300,
            damageType: DamageType.BOMB,
            startedOn: 1750314606,
            completedOn: 1750314606,
            heroDetails: [],
            machineOfWarDetails: null,
            globalConfigHash: "34e9c937e23efbb6e4a3eca6f45f7c4d",
        },
    ];

    test("seasonHighscores - Should properly transform guild raid data to season highscores", async () => {
        const transformedData =
            await dtsService.seasonHighscores(highscoreData);

        expect(transformedData).toEqual({
            "L1 AdmecManipulus": [
                {
                    username: "test2",
                    value: 300,
                    team: "Other",
                },
                {
                    username: "test1",
                    value: 200,
                    team: "Other",
                },
            ],
        });
    });

    test("highestDmgComps - Should properly transform guild raid data to highest damage comps", async () => {
        const transformedData =
            await dtsService.highestDmgComps(testGuildRaidData);

        expect(transformedData).toEqual({
            AdmecBelisarius: {
                completedOn: 1750318958,
                damageDealt: 900000,
                damageType: DamageType.BATTLE,
                encounterIndex: 0,
                encounterType: EncounterType.BOSS,
                globalConfigHash: "34e9c937e23efbb6e4a3eca6f45f7c4d",
                heroDetails: [
                    {
                        power: 511288,
                        unitId: "spaceBlackmane",
                    },
                    {
                        power: 421678,
                        unitId: "eldarFarseer",
                    },
                    {
                        power: 534662,
                        unitId: "worldKharn",
                    },
                    {
                        power: 354190,
                        unitId: "orksWarboss",
                    },
                    {
                        power: 390248,
                        unitId: "orksRuntherd",
                    },
                ],
                machineOfWarDetails: {
                    power: 218211,
                    unitId: "astraOrdnanceBattery",
                },
                maxHp: 5000000,
                rarity: Rarity.LEGENDARY,
                remainingHp: 4238881,
                set: 0,
                startedOn: 1750316881,
                tier: 4,
                type: "Belisarius",
                unitId: "GuildBoss10Boss1AdmecBelisarius",
                userId: "55aefce2-e186-44ab-8532-82732e36f232",
            },
            AdmecManipulus: {
                completedOn: 1750314243,
                damageDealt: 195387,
                damageType: DamageType.BATTLE,
                encounterIndex: 2,
                encounterType: EncounterType.SIDE_BOSS,
                globalConfigHash: "34e9c937e23efbb6e4a3eca6f45f7c4d",
                heroDetails: [
                    {
                        power: 131325,
                        unitId: "astraCreed",
                    },
                    {
                        power: 326572,
                        unitId: "astraYarrick",
                    },
                    {
                        power: 194393,
                        unitId: "blackPossession",
                    },
                    {
                        power: 206215,
                        unitId: "tauMarksman",
                    },
                    {
                        power: 159721,
                        unitId: "adeptCelestine",
                    },
                ],
                machineOfWarDetails: {
                    power: 5572,
                    unitId: "tyranBiovore",
                },
                maxHp: 350000,
                rarity: Rarity.LEGENDARY,
                remainingHp: 154613,
                set: 0,
                startedOn: 1750314154,
                tier: 4,
                type: "Belisarius",
                unitId: "GuildBoss10MiniBoss2AdmecManipulus",
                userId: "735d8c45-bac6-4770-a7e8-7f0adb0358c1",
            },
            AdmecMarshall: {
                completedOn: 1750315296,
                damageDealt: 196687,
                damageType: DamageType.BATTLE,
                encounterIndex: 1,
                encounterType: EncounterType.SIDE_BOSS,
                globalConfigHash: "34e9c937e23efbb6e4a3eca6f45f7c4d",
                heroDetails: [
                    {
                        power: 140946,
                        unitId: "orksRuntherd",
                    },
                    {
                        power: 158652,
                        unitId: "spaceBlackmane",
                    },
                    {
                        power: 120965,
                        unitId: "orksWarboss",
                    },
                    {
                        power: 214604,
                        unitId: "eldarFarseer",
                    },
                    {
                        power: 96892,
                        unitId: "eldarAutarch",
                    },
                ],
                machineOfWarDetails: {
                    power: 794,
                    unitId: "tyranBiovore",
                },
                maxHp: 300000,
                rarity: Rarity.LEGENDARY,
                remainingHp: 45095,
                set: 0,
                startedOn: 1750315090,
                tier: 4,
                type: "Belisarius",
                unitId: "GuildBoss10MiniBoss1AdmecMarshall",
                userId: "7a3cf298-b39e-49fd-849a-7553bdbe58c7",
            },
        });
    });
});
