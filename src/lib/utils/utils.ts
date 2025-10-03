import { BOSS_EMOJIS, UnitIdEmojiMapping } from "../configs/constants";
import { logger } from "../HominaLogger";

export function splitByCapital(text: string): string[] {
    // Split the text by capital letters
    const regex = /(?=[A-Z])/;
    return text.split(regex).map((s) => s.trim());
}

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

export function rankToTier(rank: number) {
    if (rank < 0 || rank >= 21) {
        throw new Error(
            `Rank (${rank}) cannot be negative or greater than or equal to 21`
        );
    }

    return rankToElement(rank) + " " + ((rank % 3) + 1);
}

export function shortenNumber(num: number): string {
    if (num < 1e3) return num.toLocaleString();
    if (num < 1e6) return (num / 1e3).toFixed(1) + "K";
    if (num < 1e9) return (num / 1e6).toFixed(1) + "M";
    return (num / 1e9).toFixed(1) + "B";
}

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
