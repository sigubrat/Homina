import { characters } from "@/lib/configs/characters";
import {
    CHART_COLORS,
    evaluateToken,
    getAllCommands,
    getTopNDamageDealers,
    getUnixTimestamp,
    hasLynchpinHeroes,
    inTeamsCheck,
    namedColor,
    sortGuildRaidResultDesc,
    sortTokensUsed,
    SecondsToString,
    mapTierToRarity,
    numericAverage,
    standardDeviation,
    numericMedian,
    isValidUUIDv4,
    splitByCapital,
    getBossEmoji,
    getMetaTeam,
    rankToElement,
    rankToTier,
    shortenNumber,
    withinNextHour,
} from "@/lib/utils";
import { MetaTeams } from "@/models/enums/MetaTeams";
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
        const heroes = [
            characters.Bellator.id,
            characters.Gulgortz.id,
            characters.Eldryon.id,
            characters.Kariyan.id,
        ];

        const result = {
            multi: 0,
            mech: 0,
            neuro: 0,
            custodes: 0,
        };
        heroes.forEach((hero) => {
            const res = inTeamsCheck(hero);
            result.multi += res.inMulti ? 1 : 0;
            result.mech += res.inMech ? 1 : 0;
            result.neuro += res.inNeuro ? 1 : 0;
            result.custodes += res.inCustodes ? 1 : 0;
        });
        expect(result).toEqual({
            multi: 3,
            mech: 1,
            neuro: 1,
            custodes: 1,
        });
    });

    test("hasLynchpinHero - Should provide true/false if lynchpins in team or not ", () => {
        const teams: string[][] = [
            [
                characters.Bellator.id,
                characters.Gulgortz.id,
                characters.Eldryon.id,
            ],
            [
                characters.Snotflogga.id,
                characters.Aethana.id,
                characters.Bellator.id,
            ],
            [
                characters.Ragnar.id,
                characters.Snotflogga.id,
                characters.Eldryon.id,
            ],
            [
                characters.Neurothrope.id,
                characters.Snotflogga.id,
                characters.Aethana.id,
            ],
            [
                characters.ExitorRho.id,
                characters.TanGida.id,
                characters.Actus.id,
            ],
            [
                characters.TyrantGuard.id,
                characters.Snotflogga.id,
                characters.Aethana.id,
            ],
            [
                characters.Kariyan.id,
                characters.Trajann.id,
                characters.Dante.id,
                characters.Kharn.id,
            ],
        ];

        const neuroTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.NEURO)),
            0
        );

        const multiTeam = teams.reduce(
            (acc, team) => acc + Number(hasLynchpinHeroes(team, MetaTeams.MH)),
            0
        );

        const mechTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.ADMECH)),
            0
        );

        const custodesTeam = teams.reduce(
            (acc, team) =>
                acc + Number(hasLynchpinHeroes(team, MetaTeams.CUSTODES)),
            0
        );

        expect(neuroTeam).toBe(1);
        expect(multiTeam).toBe(1);
        expect(mechTeam).toBe(1);
        expect(custodesTeam).toBe(1);
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
                bombCount: 0,
            },
            {
                username: "Player2",
                totalDamage: 800,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
            {
                username: "Player3",
                totalDamage: 600,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                bombCount: 0,
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
                bombCount: 0,
            },
            {
                username: "Player1",
                totalDamage: 1000,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            },
            {
                username: "Player3",
                totalDamage: 600,
                totalTokens: 0,
                boss: "",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
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
        expect(result).toBe("1d 01h 01m 01s");
    });

    test("timestampInSecondsToString - Should handle hiding days parameter correctly", () => {
        const timestampInSeconds = 86400 + 3600 + 60 + 1; // 1 day, 1 hour, 1 minute, and 1 second
        const result = SecondsToString(timestampInSeconds, true);
        expect(result).toBe("25h 01m 01s");
    });

    test("mapTierToRarity - Should map tier to rarity correctly", () => {
        expect(mapTierToRarity(0, 1)).toBe("C1");
        expect(mapTierToRarity(1, 1)).toBe("U1");
        expect(mapTierToRarity(2, 1)).toBe("R1");
        expect(mapTierToRarity(3, 1)).toBe("E1");
        expect(mapTierToRarity(4, 1)).toBe("L1");
        expect(mapTierToRarity(5, 1)).toBe("M1");
        expect(mapTierToRarity(6, 1)).toBe("L1 :recycle:1");
        expect(mapTierToRarity(7, 1)).toBe("M1 :recycle:1");
        expect(() => mapTierToRarity(-1, 1)).toThrow("Tier cannot be negative");
    });

    test("numericAverage - returns correct average for non-empty array", () => {
        expect(numericAverage([1, 2, 3, 4, 5])).toBe(3);
        expect(numericAverage([10, 20])).toBe(15);
    });
    test("numericAverage - returns 0 for empty array", () => {
        expect(numericAverage([])).toBe(0);
    });

    test("standardDeviation - returns correct stddev for array", () => {
        expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 5);
        expect(standardDeviation([1, 1, 1, 1])).toBe(0);
    });
    test("standardDeviation - returns 0 for empty array", () => {
        expect(standardDeviation([])).toBe(0);
    });

    test("numericMedian - returns correct median for odd/even arrays", () => {
        expect(numericMedian([1, 2, 3, 4, 5])).toBe(3);
        expect(numericMedian([1, 2, 3, 4])).toBe(2.5);
    });

    test("numericMedian - returns 0 for empty array", () => {
        expect(numericMedian([])).toBe(0);
    });

    test("isValidUUIDv4 - validates correct and incorrect UUIDs", () => {
        expect(isValidUUIDv4("123e4567-e89b-12d3-a456-426614174000")).toBe(
            false
        ); // not v4
        expect(isValidUUIDv4("123e4567-e89b-42d3-a456-426614174000")).toBe(
            true
        ); // valid v4
        expect(isValidUUIDv4("invalid-uuid")).toBe(false);
    });

    test("splitByCapital - should split a camelCase string into words", () => {
        const camelCaseString = "CamelCaseStringExample";
        const result = splitByCapital(camelCaseString);
        expect(result).toEqual(["Camel", "Case", "String", "Example"]);
    });

    test("splitByCapital - should handle an empty string", () => {
        const camelCaseString = "";
        const result = splitByCapital(camelCaseString);
        expect(result).toEqual([""]);
    });

    test("splitByCapital - should handle first word with lowercase", () => {
        const camelCaseString = "lowerCamelCase";
        const result = splitByCapital(camelCaseString);
        expect(result).toEqual(["lower", "Camel", "Case"]);
    });

    test("splitByCapital - should handle dashes and underscores appropriately", () => {
        const boss = "Screamer-Killer";
        const result = splitByCapital(boss);
        expect(result).toEqual(["Screamer-", "Killer"]);
    });

    test("getBossEmoji - Should return correct emoji for known bosses", () => {
        expect(getBossEmoji("xxSzarekh")).toBe(
            "<:Szarekh:1385343132950069278>"
        );
        expect(getBossEmoji("xxTervigon (Leviathan)")).toBe(
            "<:TyrantLeviathan:1385342042170851334>"
        );
        expect(getBossEmoji("xxTervigon (Gorgon)")).toBe(
            "<:TyrantGorgon:1385340907351441619>"
        );
        expect(getBossEmoji("xxTervigon (Kronos)")).toBe(
            "<:TyrantKronos:1385341128626409522>"
        );
        expect(getBossEmoji("xxHive Tyrant (Leviathan)")).toBe(
            "<:TyrantLeviathan:1385342042170851334>"
        );
        expect(getBossEmoji("xxHive Tyrant (Gorgon)")).toBe(
            "<:TyrantGorgon:1385340907351441619>"
        );
        expect(getBossEmoji("xxHive Tyrant (Kronos)")).toBe(
            "<:TyrantKronos:1385341128626409522>"
        );
        expect(getBossEmoji("xxGhazghkull")).toBe(
            "<:Ghazghkull:1385340195494170664>"
        );
        expect(getBossEmoji("xxAvatar")).toBe("<:Avatar:1385338950834716802>");
        expect(getBossEmoji("xxMagnus")).toBe("<:Magnus:1385342412217520379>");
        expect(getBossEmoji("xxMortarion")).toBe(
            "<:Mortarion:1385342557969453197>"
        );
        expect(getBossEmoji("xxBelisarius")).toBe(
            "<:Cawl:1385339595578806312>"
        );
        expect(getBossEmoji("xxRogal")).toBe(
            "<:RogalDornTank:1385342727037784174>"
        );
        expect(getBossEmoji("xxScreamer-Killer")).toBe(
            "<:ScreamerKiller:1385342920302788608>"
        );
        expect(getBossEmoji("xxRiptide")).toBe(
            "<:Riptide:1410163322531217419>"
        );
    });

    test("getBossEmoji - Should return fallback emoji for unknown or malformed input", () => {
        expect(getBossEmoji("")).toBe("❓");
        expect(getBossEmoji("xxUnknownBoss")).toBe("❓");
        expect(getBossEmoji("x")).toBe("❓");
    });

    test("getMetaTeam - Should return the correct meta team", () => {
        const multihitTeam = [
            characters.Bellator.id,
            characters.Gulgortz.id,
            characters.Eldryon.id,
            "templHelbrecht",
            characters.Ragnar.id,
        ];
        const metaTeam = getMetaTeam(multihitTeam);
        expect(metaTeam).toEqual(MetaTeams.MH);

        const admechTeam = [
            "necroSpyder",
            characters.ExitorRho.id,
            "tauCrisis",
            "admecMarshall",
            "admecDominus",
            "admecManipulus",
        ];

        expect(getMetaTeam(admechTeam)).toEqual(MetaTeams.ADMECH);
        const neuroTeam = [
            characters.Eldryon.id,
            characters.Neurothrope.id,
            "genesMagus",
            "adeptCanoness",
            "bloodMephiston",
        ];
        expect(getMetaTeam(neuroTeam)).toEqual(MetaTeams.NEURO);
    });

    test("getMetaTeam - Should return OTHER for teams not matching any meta", () => {
        const otherTeam = [
            "thousAhriman",
            "tauCrisis",
            characters.Eldryon.id,
            characters.ExitorRho.id,
            characters.Ragnar.id,
            "thousInfernalMaster",
        ];
        expect(getMetaTeam(otherTeam)).toEqual(MetaTeams.OTHER);
    });

    test("rankToElement - Should convert rank to element correctly", () => {
        expect(rankToElement(0)).toBe("Stone");
        expect(rankToElement(3)).toBe("Iron");
        expect(rankToElement(6)).toBe("Bronze");
        expect(rankToElement(9)).toBe("Silver");
        expect(rankToElement(12)).toBe("Gold");
        expect(rankToElement(15)).toBe("Diamond");
        expect(rankToElement(18)).toBe("Adamantium");
        expect(() => rankToElement(-1)).toThrow();
        expect(() => rankToElement(21)).toThrow();
    });

    test("rankToTier - Should convert rank to tier correctly", () => {
        expect(rankToTier(0)).toBe("Stone 1");
        expect(rankToTier(1)).toBe("Stone 2");
        expect(rankToTier(2)).toBe("Stone 3");
        expect(rankToTier(3)).toBe("Iron 1");
        expect(rankToTier(4)).toBe("Iron 2");
        expect(rankToTier(5)).toBe("Iron 3");
        expect(rankToTier(6)).toBe("Bronze 1");
        expect(rankToTier(7)).toBe("Bronze 2");
        expect(rankToTier(8)).toBe("Bronze 3");
        expect(rankToTier(9)).toBe("Silver 1");
        expect(rankToTier(10)).toBe("Silver 2");
        expect(rankToTier(11)).toBe("Silver 3");
        expect(rankToTier(12)).toBe("Gold 1");
        expect(rankToTier(13)).toBe("Gold 2");
        expect(rankToTier(14)).toBe("Gold 3");
        expect(rankToTier(15)).toBe("Diamond 1");
        expect(rankToTier(16)).toBe("Diamond 2");
        expect(rankToTier(17)).toBe("Diamond 3");
        expect(rankToTier(18)).toBe("Adamantium 1");
        expect(rankToTier(19)).toBe("Adamantium 2");
        expect(rankToTier(20)).toBe("Adamantium 3");
        expect(() => rankToTier(-1)).toThrow();
        expect(() => rankToTier(21)).toThrow();
    });

    test("shortenNumber - Should shorten numbers correctly", () => {
        expect(shortenNumber(999)).toBe("999");
        expect(shortenNumber(1000)).toBe("1.0K");
        expect(shortenNumber(1500)).toBe("1.5K");
        expect(shortenNumber(1000000)).toBe("1.0M");
        expect(shortenNumber(2500000)).toBe("2.5M");
        expect(shortenNumber(1000000000)).toBe("1.0B");
        expect(shortenNumber(15000000000)).toBe("15.0B");
    });

    test("withinNextHour - Should return true for cooldowns within the next hour", () => {
        expect(withinNextHour("00h30m")).toBe(true);
        expect(withinNextHour("00h32m")).toBe(true);
        expect(withinNextHour("00h00m")).toBe(true);
    });

    test("withinNextHour - Should return false for cooldowns outside the next hour", () => {
        expect(withinNextHour("01h01m")).toBe(false);
        expect(withinNextHour("02h00m")).toBe(false);
    });
});
