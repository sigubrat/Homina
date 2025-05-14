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
            "TervigonLeviathan-0": {
                time: "0h 0m 0s",
                tokens: 1,
            },
            "HiveTyrantLeviathan-0": {
                time: "0h 0m 0s",
                tokens: 1,
            },
            "HiveTyrantGorgon-0": {
                time: "0h 0m 0s",
                tokens: 1,
            },
            "ScreamerKiller-0": {
                time: "0h 7m 59s",
                tokens: 3,
            },
        });
    });
});
