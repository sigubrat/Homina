import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { describe, expect, test } from "bun:test";
import { guildRaidResultFixture } from "../testFixtures";

const dtsService = new DataTransformationService();
const testGuildRaidData = guildRaidResultFixture;

describe("DataTransformationServiceSuite - Algebra", () => {
    test("Should properly transform guild raid data to tokens and time used per boss", async () => {
        const transformedData = await dtsService.timeUsedPerBoss(
            testGuildRaidData
        );
        expect(transformedData).toEqual({
            "TervigonLeviathan-Common-0": {
                time: "0h 0m 0s",
                tokens: 1,
            },
            "HiveTyrantLeviathan-Common-1": {
                time: "0h 1m 1s",
                tokens: 1,
            },
            "HiveTyrantGorgon-Common-2": {
                time: "0h 0m 59s",
                tokens: 1,
            },
            "ScreamerKiller-Common-3": {
                time: "0h 27m 32s",
                tokens: 2,
            },
        });
    });
});
