import { BOSS_EMOJIS, UnitIdEmojiMapping } from "../configs/constants";
import { logger } from "../HominaLogger";

/**
 * Splits a string into an array of substrings at each capital letter.
 *
 * Each substring is trimmed of leading and trailing whitespace.
 * For example, `"HelloWorld"` becomes `["Hello", "World"]`.
 *
 * @param text - The input string to split.
 * @returns An array of substrings split at each capital letter.
 */
export function splitByCapital(text: string): string[] {
    // Split the text by capital letters
    const regex = /(?=[A-Z])/;
    return text.split(regex).map((s) => s.trim());
}

/**
 * Maps a numeric tier and set to a rarity string representation.
 *
 * - Tiers 0-5 map directly to rarity letters:
 *   - 0: "C" (Common)
 *   - 1: "U" (Uncommon)
 *   - 2: "R" (Rare)
 *   - 3: "E" (Epic)
 *   - 4: "L" (Legendary)
 *   - 5: "M" (Mythic)
 * - For tiers 6 and above, alternates between "L" and "M" and appends a recycle count if `loops` is true.
 *   - Even recycle: "L"
 *   - Odd recycle: "M"
 *   - Example: tier 6 → "L{set} :recycle:{recycleCount}"
 *
 * @param tier - The tier number (must be non-negative).
 * @param set - The set identifier to append to the rarity letter.
 * @param loops - If true, appends a recycle count for tiers 6 and above. Defaults to true.
 * @returns The mapped rarity string.
 * @throws {Error} If `tier` is negative.
 */
export function mapTierToRarity(
    tier: number,
    set: number,
    loops: boolean = true
): string {
    if (tier < 0) {
        throw new Error("Tier cannot be negative");
    }

    if (tier === 0) {
        return `C${set}`;
    } else if (tier === 1) {
        return `U${set}`;
    } else if (tier === 2) {
        return `R${set}`;
    } else if (tier === 3) {
        return `E${set}`;
    } else if (tier === 4) {
        return `L${set}`;
    } else if (tier === 5) {
        return `M${set}`;
    }

    // For rarity 6+, alternate between L and M
    // rarity 6 -> L, rarity 7 -> M, rarity 8 -> L, etc.
    const recycleCount = Math.floor((tier - 4) / 2);
    const isEvenRecycle = (tier - 6) % 2 === 0;
    const rarityLetter = isEvenRecycle ? "L" : "M";

    if (loops) {
        return `${rarityLetter}${set} :recycle:${recycleCount}`;
    } else {
        return `${rarityLetter}${set}`;
    }
}

/**
 * Returns the corresponding emoji for a given boss name.
 *
 * The function matches the provided boss string (case-insensitive) against known boss names and subtypes.
 * For Tyranid bosses ("tervigon" or "hive"), it further checks for specific subtypes ("leviathan", "gorgon", "kronos").
 * If a match is found, the corresponding emoji from `BOSS_EMOJIS` is returned; otherwise, a default "❓" emoji is returned.
 *
 * @param boss - The name of the boss to retrieve the emoji for.
 * @returns The emoji representing the boss, or "❓" if no match is found.
 */
export function getBossEmoji(boss: string) {
    boss = boss.toLowerCase();

    if (boss.includes("szarekh")) {
        return BOSS_EMOJIS.Szarekh || "❓";
    } else if (boss.includes("tervigon")) {
        if (boss.includes("leviathan"))
            return BOSS_EMOJIS.TyrantLeviathan || "❓";
        if (boss.includes("gorgon")) return BOSS_EMOJIS.TyrantGorgon || "❓";
        if (boss.includes("kronos")) return BOSS_EMOJIS.TyrantKronos || "❓";
    } else if (boss.includes("hive")) {
        if (boss.includes("leviathan"))
            return BOSS_EMOJIS.TyrantLeviathan || "❓";
        if (boss.includes("gorgon")) return BOSS_EMOJIS.TyrantGorgon || "❓";
        if (boss.includes("kronos")) return BOSS_EMOJIS.TyrantKronos || "❓";
    } else if (boss.includes("ghazghkull")) {
        return BOSS_EMOJIS.Ghazghkull || "❓";
    } else if (boss.includes("avatar")) {
        return BOSS_EMOJIS.Avatar || "❓";
    } else if (boss.includes("magnus")) {
        return BOSS_EMOJIS.Magnus || "❓";
    } else if (boss.includes("mortarion")) {
        return BOSS_EMOJIS.Mortarion || "❓";
    } else if (boss.includes("belisarius")) {
        return BOSS_EMOJIS.Belisarius || "❓";
    } else if (boss.includes("rogal")) {
        return BOSS_EMOJIS.RogalDornTank || "❓";
    } else if (boss.includes("screamer-")) {
        return BOSS_EMOJIS.Screamer || "❓";
    } else if (boss.includes("riptide")) {
        return BOSS_EMOJIS.Riptide || "❓";
    } else {
        return "❓";
    }
}

/**
 * Maps a unit ID (`unitTid`) to its corresponding emoji representation.
 *
 * If an exact match is found in the `UnitIdEmojiMapping`, returns the associated emoji.
 * Otherwise, performs a case-insensitive partial match between the keys and the provided `unitTid`.
 * If a partial match is found, returns the corresponding emoji.
 * If no match is found, returns the original `unitTid`.
 *
 * @param unitTid - The unit ID to map to an emoji.
 * @returns The emoji corresponding to the unit ID, or the original `unitTid` if no match is found.
 */
export function mapUnitIdToEmoji(unitTid: string): string {
    if (UnitIdEmojiMapping[unitTid]) {
        return UnitIdEmojiMapping[unitTid];
    }

    for (const [key, emoji] of Object.entries(UnitIdEmojiMapping)) {
        if (
            key.toLowerCase().includes(unitTid.toLowerCase()) ||
            unitTid.toLowerCase().includes(key.toLowerCase())
        ) {
            return emoji;
        }
    }

    return unitTid;
}

/**
 * Returns the element name corresponding to a given rank.
 *
 * The mapping is as follows:
 * - 0 <= rank < 3: "Stone"
 * - 3 <= rank < 6: "Iron"
 * - 6 <= rank < 9: "Bronze"
 * - 9 <= rank < 12: "Silver"
 * - 12 <= rank < 15: "Gold"
 * - 15 <= rank < 18: "Diamond"
 * - 18 <= rank < 21: "Adamantium"
 *
 * @param rank - The rank number to map to an element. Must be between 0 (inclusive) and 21 (exclusive).
 * @returns The name of the element corresponding to the given rank.
 * @throws {Error} If the rank is negative or greater than or equal to 21.
 */
export function rankToElement(rank: number) {
    if (rank >= 0 && rank < 3) {
        return "Stone";
    } else if (rank >= 3 && rank < 6) {
        return "Iron";
    } else if (rank >= 6 && rank < 9) {
        return "Bronze";
    } else if (rank >= 9 && rank < 12) {
        return "Silver";
    } else if (rank >= 12 && rank < 15) {
        return "Gold";
    } else if (rank >= 15 && rank < 18) {
        return "Diamond";
    } else if (rank >= 18 && rank < 21) {
        return "Adamantium";
    } else {
        throw new Error(
            `Rank (${rank}) cannot be negative or greater than or equal to 21`
        );
    }
}

/**
 * Converts a numeric rank to its corresponding tier string.
 *
 * The tier string is composed of the element name (as determined by `rankToElement`)
 * and a tier number (1, 2, or 3), based on the rank modulo 3.
 *
 * @param rank - The rank number to convert. Must be in the range [0, 20].
 * @returns The tier string in the format "<Element> <TierNumber>".
 * @throws {Error} If the rank is negative or greater than or equal to 21.
 */
export function rankToTier(rank: number) {
    if (rank < 0 || rank >= 21) {
        throw new Error(
            `Rank (${rank}) cannot be negative or greater than or equal to 21`
        );
    }

    return rankToElement(rank) + " " + ((rank % 3) + 1);
}

/**
 * Converts a number into a shortened string representation using metric suffixes.
 *
 * - Numbers less than 1,000 are formatted with locale separators.
 * - Numbers in the thousands are suffixed with "K".
 * - Numbers in the millions are suffixed with "M".
 * - Numbers in the billions are suffixed with "B".
 *
 * All suffixed numbers are rounded to one decimal place.
 *
 * @param num - The number to shorten.
 * @returns The shortened string representation of the number.
 */
export function shortenNumber(num: number): string {
    if (num < 1e3) return num.toLocaleString();
    if (num < 1e6) return (num / 1e3).toFixed(1) + "K";
    if (num < 1e9) return (num / 1e6).toFixed(1) + "M";
    return (num / 1e9).toFixed(1) + "B";
}

/**
 * Asynchronously retrieves the version string from the project's `package.json` file.
 *
 * @returns {Promise<string | null>} A promise that resolves to the version string if found,
 * or `null` if an error occurs during reading or parsing.
 *
 * @remarks
 * This function uses Bun's file API to read and parse the `package.json` file.
 * If the file cannot be read or parsed, the error is logged and `null` is returned.
 */
export async function getPackageVersion(): Promise<string | null> {
    const packageJsonPath = "package.json";
    try {
        const file = Bun.file(packageJsonPath);
        const data = await file.json();
        return data.version as string;
    } catch (error) {
        logger.error(error, "Error reading or parsing package.json:");
        return null;
    }
}
