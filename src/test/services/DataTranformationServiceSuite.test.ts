import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { describe, expect, test } from "bun:test";
import { RaidResultFixture } from "../testFixtures";
import type { Raid } from "@/models/types";
import { DamageType, EncounterType, Rarity } from "@/models/enums";

const dtsService = new DataTransformationService();
const testGuildRaidData = RaidResultFixture;

describe("DataTransformationServiceSuite - Algebra", () => {
    test("timeUsedPerBoss - Should properly transform guild raid data to tokens and time used per boss", async () => {
        const transformedData = await dtsService.timeUsedPerBoss(
            testGuildRaidData
        );

        expect(transformedData).toEqual([
            {
                "L1 Belisarius": {
                    time: "00h 45m 27s",
                    tokens: 4,
                    bombs: 4,
                    sideboss: [true, "L1 Belisarius"],
                },
            },
            "00h 45m 27s",
        ]);
    });

    test("timeUsedPerBoss - should display primes as well if the option is enabled", async () => {
        const transformedData = await dtsService.timeUsedPerBoss(
            testGuildRaidData,
            true
        );

        expect(transformedData).toEqual([
            {
                "L1 AdmecManipulus": {
                    time: "00h 15m 07s",
                    tokens: 1,
                    bombs: 3,
                    sideboss: [true, "L1 Belisarius"],
                },
                "L1 AdmecMarshall": {
                    time: "00h 30m 03s",
                    tokens: 2,
                    bombs: 1,
                    sideboss: [true, "L1 Belisarius"],
                },
                "L1 Belisarius": {
                    time: "00h 00m 17s",
                    tokens: 1,
                    bombs: 0,
                    sideboss: [false, "L1 Belisarius"],
                },
            },
            "00h 45m 27s",
        ]);
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
        const transformedData = await dtsService.seasonHighscores(
            highscoreData
        );

        expect(transformedData).toEqual({
            "L1 AdmecManipulus": [
                {
                    username: "test1",
                    value: 200,
                    team: "Other",
                },
                {
                    username: "test2",
                    value: 300,
                    team: "Other",
                },
            ],
        });
    });
});
