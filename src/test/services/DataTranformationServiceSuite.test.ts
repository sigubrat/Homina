import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { describe, expect, test } from "bun:test";
import { RaidResultFixture } from "../testFixtures";

const dtsService = new DataTransformationService();
const testGuildRaidData = RaidResultFixture;

describe("DataTransformationServiceSuite - Algebra", () => {
    test("timeUsedPerBoss - Should properly transform guild raid data to tokens and time used per boss", async () => {
        const transformedData = await dtsService.timeUsedPerBoss(
            testGuildRaidData
        );

        expect(transformedData).toEqual([
            {
                "L0 Belisarius": {
                    time: "00h 45m 27s",
                    tokens: 4,
                    bombs: 4,
                    sideboss: [true, "L0 Belisarius"],
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
                "L0 AdmecManipulus": {
                    time: "00h 15m 07s",
                    tokens: 1,
                    bombs: 3,
                    sideboss: [true, "L0 Belisarius"],
                },
                "L0 AdmecMarshall": {
                    time: "00h 30m 03s",
                    tokens: 2,
                    bombs: 1,
                    sideboss: [true, "L0 Belisarius"],
                },
                "L0 Belisarius": {
                    time: "00h 00m 17s",
                    tokens: 1,
                    bombs: 0,
                    sideboss: [false, "L0 Belisarius"],
                },
            },
            "00h 45m 27s",
        ]);
    });
});
