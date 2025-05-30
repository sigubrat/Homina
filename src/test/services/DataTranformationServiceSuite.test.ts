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
        expect(transformedData).toEqual({
            "TervigonLeviathan-Common": {
                time: "00h 00m 00s",
                tokens: 1,
            },
            "HiveTyrantLeviathan-Common": {
                time: "00h 01m 01s",
                tokens: 1,
            },
            "HiveTyrantGorgon-Common": {
                time: "00h 00m 59s",
                tokens: 1,
            },
            "ScreamerKiller-Common": {
                time: "00h 27m 32s",
                tokens: 2,
            },
        });
    });
});
