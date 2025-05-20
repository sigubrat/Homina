import {
    CHART_COLORS,
    evaluateToken,
    getAllCommands,
    getTopNDamageDealers,
    getUnixTimestamp,
    hasLynchpinHero,
    inTeamsCheck,
    namedColor,
    sortGuildRaidResultDesc,
    sortTokensUsed,
    SecondsToString,
    mapTierToRarity,
} from "@/lib/utils";
import type { GuildRaidResult } from "@/models/types";
import { describe, expect, test } from "bun:test";

describe("utilsSuite - Algebra", () => {
    test("getCommands - Should fetch a promise that resolves to a collection of commands", async () => {
        const commands = await getAllCommands();
        expect(commands).toBeDefined();
        expect(commands.size).toBeGreaterThan(0);
        expect(commands.first()).toHaveProperty("data");
        expect(commands.first()).toHaveProperty("execute");
    });

    test("namedColor - Should return the correct color", () => {
        const index = 1;
        const color = namedColor(index);
        expect(color).toBe("rgb(255, 159, 64)");
    });

    test("CHART_COLORS - Should return the correct color", () => {
        const color = CHART_COLORS.red;
        expect(color).toBe("rgb(255, 99, 132)");
    });

    test("inTeamsCheck - Should return a correct check", () => {
        const heroes = ["ultraInceptorSgt", "orksWarboss", "eldarFarseer"];

        const result = {
            multi: 0,
            mech: 0,
            neuro: 0,
        };
        heroes.forEach((hero) => {
            const res = inTeamsCheck(hero);
            result.multi += res.inMulti ? 1 : 0;
            result.mech += res.inMech ? 1 : 0;
            result.neuro += res.inPsyker ? 1 : 0;
        });
        expect(result).toEqual({
            multi: 3,
            mech: 1,
            neuro: 1,
        });
    });

    test("hasLynchpinHero - Should provide true/false if lynchpin in team or not ", () => {
        const teams: string[][] = [
            ["ultraInceptorSgt", "orksWarboss", "eldarFarseer"],
            ["orksRuntherd", "eldarAutarch", "ultraInceptorSgt"],
            ["spaceBlackmane", "orksRuntherd", "eldarFarseer"],
            ["tyraanNeurothrope", "orksRuntherd", "eldarAutarch"],
            ["admecRuststalker", "orksRuntherd", "eldarFarseer"],
            ["tyranNeurothrope", "orksRuntherd", "eldarAutarch"],
        ];

        const psykerTeam = teams.reduce(
            (acc, team) => acc + Number(hasLynchpinHero(team, "psyker")),
            0
        );

        const multiTeam = teams.reduce(
            (acc, team) => acc + Number(hasLynchpinHero(team, "multihit")),
            0
        );

        const mechTeam = teams.reduce(
            (acc, team) => acc + Number(hasLynchpinHero(team, "mech")),
            0
        );

        expect(psykerTeam).toBe(1);
        expect(multiTeam).toBe(1);
        expect(mechTeam).toBe(1);
    });

    test("getTopNDamageDealers - Should return the top N damage dealers", () => {
        const sortedData: GuildRaidResult[] = [
            {
                username: "Player1",
                totalDamage: 1000,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
            },
            {
                username: "Player2",
                totalDamage: 800,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
            },
            {
                username: "Player3",
                totalDamage: 600,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
            },
        ];
        const n = 2;
        const result = getTopNDamageDealers(sortedData, n);
        expect(result).toEqual(["🥇 Player1: 1,000", "🥈 Player2: 800"]);
    });

    test("sortGuildRaidResultDesc - Should sort the guild raid result in descending order", () => {
        const data: GuildRaidResult[] = [
            {
                username: "Player2",
                totalDamage: 800,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
            },
            {
                username: "Player1",
                totalDamage: 1000,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
            },
            {
                username: "Player3",
                totalDamage: 600,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
            },
        ];
        const result = sortGuildRaidResultDesc(data);
        expect(result[0]!.username).toBe("Player1");
        expect(result[1]!.username).toBe("Player2");
        expect(result[2]!.username).toBe("Player3");
    });

    test("sortTokensUsed - Should sort the tokens used in descending order", () => {
        const data = [
            { username: "Test1", boss: "Boss1", tokens: 5 },
            { username: "Test2", boss: "Boss2", tokens: 10 },
            { username: "Test3", boss: "Boss3", tokens: 7 },
        ];
        const result = sortTokensUsed(data);
        expect(result[0]!.tokens).toBe(10);
        expect(result[1]!.tokens).toBe(7);
        expect(result[2]!.tokens).toBe(5);
        expect(result[0]!.username).toBe("Test2");
        expect(result[1]!.username).toBe("Test3");
        expect(result[2]!.username).toBe("Test1");
    });

    test("getUnixTimestamp - Should return the correct unix timestamp", () => {
        const date = new Date("2023-10-01T00:00:00Z");
        const timestamp = getUnixTimestamp(date);
        expect(timestamp).toBe(1696118400);
    });

    test("evaluateToken - Should evaluate the token correctly", () => {
        const token = {
            count: 1,
            refreshTime: 1696118400,
        };
        // 13 hour later
        const timestampInSeconds = 1696168800;
        const evaluatedToken = evaluateToken(token, timestampInSeconds);
        expect(evaluatedToken.count).toBe(2);
        expect(evaluatedToken.refreshTime).toBe(1696161600);
    });

    test("timestampInSecondsToString - Should convert timestamp to string correctly", () => {
        const timestampInSeconds = 86400 + 3600 + 60 + 1; // 1 day, 1 hour, 1 minute, and 1 second
        const result = SecondsToString(timestampInSeconds);
        expect(result).toBe("1d 1h 1m 1s");
    });

    test("mapTierToRarity - Should map tier to rarity correctly", () => {
        expect(mapTierToRarity(0)).toBe("Common");
        expect(mapTierToRarity(1)).toBe("Uncommon");
        expect(mapTierToRarity(2)).toBe("Rare");
        expect(mapTierToRarity(3)).toBe("Epic");
        expect(() => mapTierToRarity(-1)).toThrow("Tier cannot be negative");
    });
});
