import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { describe, expect, test } from "bun:test";
import { RaidResultFixture } from "../testFixtures";

console.log("DataTransformationServiceSuite - Algebra");

const dtsService = new DataTransformationService();
const testGuildRaidData = RaidResultFixture;

describe("DataTransformationServiceSuite - Algebra", () => {
    test("timeUsedPerBoss - Should properly transform guild raid data to tokens and time used per boss", async () => {
        const transformedData = await dtsService.timeUsedPerBoss(
            testGuildRaidData
        );
        expect(transformedData).toEqual({
            "TervigonLeviathan-Common": {
                time: "0h 0m 0s",
                tokens: 1,
            },
            "HiveTyrantLeviathan-Common": {
                time: "0h 1m 1s",
                tokens: 1,
            },
            "HiveTyrantGorgon-Common": {
                time: "0h 0m 59s",
                tokens: 1,
            },
            "ScreamerKiller-Common": {
                time: "0h 27m 32s",
                tokens: 2,
            },
        });
    });
});

console.log("DataTransformationServiceSuite - Algebra - END");
