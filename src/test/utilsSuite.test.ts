import {
    mapTierToRarity,
    splitByCapital,
    getBossEmoji,
    rankToElement,
    rankToTier,
} from "@/lib/utils/utils";
import { describe, expect, test } from "bun:test";

describe("utilsSuite - Algebra", () => {
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
});
