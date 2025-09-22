import * as fs from "fs/promises";
import * as path from "path";
import { Collection } from "discord.js";
import { HominaTacticusClient } from "@/client";
import type { GuildRaidResult } from "@/models/types";
import type { TokensUsed } from "@/models/types/TokensUsed";
import type { TokenStatus } from "@/models/types/TokenStatus";
import { BOSS_EMOJIS } from "./configs/constants";
import { MetaTeams } from "@/models/enums/MetaTeams";
import type { MetaComps } from "@/models/types/MetaComps";

async function getCommands(
    commandsPath: string
): Promise<Collection<string, any>> {
    const commandsCollection = new Collection<string, any>();
    const commandFiles = await fs.readdir(commandsPath);

    for (const file of commandFiles) {
        if (file.endsWith(".ts") || file.endsWith(".js")) {
            const command = await import(path.join(commandsPath, file));
            if (command.data && command.data.name) {
                commandsCollection.set(command.data.name, command);
            }
        }
    }

    return commandsCollection;
}

export async function getAllCommands(): Promise<Collection<string, any>> {
    try {
        const commandsRoot = path.join(__dirname, "../commands");
        const sources = await fs.readdir(commandsRoot, { withFileTypes: true });
        const categoryDirs = sources
            .filter((d) => d.isDirectory())
            .map((d) => d.name);

        const commandsCollection = new Collection<string, any>();
        for (const category of categoryDirs) {
            const commandsPath = path.join(commandsRoot, category);
            const commands = await getCommands(commandsPath);
            commands.forEach((cmd, key) => commandsCollection.set(key, cmd));
        }
        return commandsCollection;
    } catch (error) {
        console.error("Error loading commands:", error);
        throw error;
    }
}

export async function testApiToken(token: string): Promise<boolean> {
    try {
        const client = new HominaTacticusClient();

        const resp = await client.getGuild(token);

        return resp.success;
    } catch (error) {
        console.error("Error testing API token:", error);
        return false;
    }
}

export async function testPlayerApiToken(token: string): Promise<boolean> {
    try {
        const client = new HominaTacticusClient();

        const resp = await client.getPlayer(token);

        return resp.success;
    } catch (error) {
        console.error("Error testing Player API token:", error);
        return false;
    }
}

export function splitByCapital(text: string): string[] {
    // Split the text by capital letters
    const regex = /(?=[A-Z])/;
    return text.split(regex).map((s) => s.trim());
}

//**
// ChartJs utils
//  */

export const CHART_COLORS = {
    red: "rgb(255, 99, 132)",
    orange: "rgb(255, 159, 64)",
    yellow: "rgb(255, 205, 86)",
    green: "rgb(75, 192, 192)",
    blue: "rgb(54, 162, 235)",
    purple: "rgb(153, 102, 255)",
    grey: "rgb(201, 203, 207)",
    discordbg: "rgb(57,58,65)",
};

const NAMED_COLORS = [
    CHART_COLORS.red,
    CHART_COLORS.orange,
    CHART_COLORS.yellow,
    CHART_COLORS.green,
    CHART_COLORS.blue,
    CHART_COLORS.purple,
    CHART_COLORS.grey,
    CHART_COLORS.discordbg,
];

export function namedColor(index: number) {
    return NAMED_COLORS[index % NAMED_COLORS.length];
}

//**
// Tacticus utils
//  */

// PublicHeroDetail ids

export const multiHitTeam = [
    "ultraInceptorSgt", // Bellator
    "eldarAutarch", // Aethana
    "orksRuntherd", // Snotflogga
    "eldarFarseer", // Eldryon
    "orksWarboss", // Gulgortz
    "worldKharn", // Kharn
    "spaceBlackmane", // Ragnar
    "templHelbrecht", // Helbrecht
    "bloodDante", // Dante
    "ultraCalgar", // Calgar
    "tauAunShi", // Aun'shi
    "darkaAsmodai", // Asmodai
    "darkaCompanion", // Forcas
    "custoTrajann", // Trajann
];

export const mechTeam = [
    "necroSpyder", // Aleph-Null
    "admecManipulus", // Actus
    "admecMarshall", // Tan Gi'da
    "admecRuststalker", // Exitor-Rho
    "orksWarboss", // Gulgortz
    "tauMarksman", // Sho'syl
    "tauCrisis", // Re'vas
    "admecDominus", // Vitruvius
    "templHelbrecht", // Helbrecht
];

export const psykerTeam = [
    "eldarFarseer", // Eldryon
    "thousTzaangor", // Yazaghor
    "thousAhriman", // Ahriman
    "tyranNeurothrope", // Neurothrope
    "thousInfernalMaster", // Abraxas
    "adeptCanoness", // Roswitha
    "genesMagus", // Xybia
    "bloodMephiston", // Mephiston
];

export interface TeamCheck {
    inMulti: boolean;
    inMech: boolean;
    inPsyker: boolean;
}

export function inTeamsCheck(hero: string): TeamCheck {
    const teamCheck: TeamCheck = {
        inMulti: false,
        inMech: false,
        inPsyker: false,
    };

    teamCheck.inMulti = multiHitTeam.includes(hero);
    teamCheck.inMech = mechTeam.includes(hero);
    teamCheck.inPsyker = psykerTeam.includes(hero);

    return teamCheck;
}

const lynchpinHeroes: Record<string, string[]> = {
    multihit: ["spaceBlackmane"],
    mech: ["admecRuststalker", "admecManipulus", "admecMarshall"],
    psyker: ["tyranNeurothrope"],
};

export function hasLynchpinHeroes(heroes: string[], team: string): boolean {
    const requiredHeroes = lynchpinHeroes[team];
    if (!requiredHeroes || requiredHeroes.length === 0) {
        return false;
    }
    return requiredHeroes.every((requiredHero) =>
        heroes.includes(requiredHero)
    );
}

export function getMetaTeam(heroes: string[]): MetaTeams {
    const teamCheck = heroes.map((hero) => inTeamsCheck(hero));
    const distribution = {
        mh: 0,
        admech: 0,
        neuro: 0,
    };

    teamCheck.forEach((check) => {
        if (check.inMulti) distribution.mh++;
        if (check.inMech) distribution.admech++;
        if (check.inPsyker) distribution.neuro++;
    });

    if (distribution.mh >= 5 && hasLynchpinHeroes(heroes, "multihit")) {
        return MetaTeams.MH;
    }

    if (distribution.admech >= 5 && hasLynchpinHeroes(heroes, "mech")) {
        return MetaTeams.ADMECH;
    }

    if (distribution.neuro >= 5 && hasLynchpinHeroes(heroes, "psyker")) {
        return MetaTeams.NEURO;
    }

    return MetaTeams.OTHER;
}

export function getMetaTeams(heroes: string[]): MetaComps {
    const teamCheck = heroes.map((hero) => inTeamsCheck(hero));
    const distribution = {
        multihit: 0,
        admech: 0,
        neuro: 0,
    };

    const retval: MetaComps = {
        multihit: false,
        admech: false,
        neuro: false,
    };

    teamCheck.forEach((check) => {
        if (check.inMulti) distribution.multihit++;
        if (check.inMech) distribution.admech++;
        if (check.inPsyker) distribution.neuro++;
    });

    if (distribution.multihit >= 5 && hasLynchpinHeroes(heroes, "multihit")) {
        retval.multihit = true;
    }

    if (distribution.admech >= 5 && hasLynchpinHeroes(heroes, "mech")) {
        retval.admech = true;
    }
    if (distribution.neuro >= 5 && hasLynchpinHeroes(heroes, "psyker")) {
        retval.neuro = true;
    }

    return retval;
}

// Nb! Relies on the user providing sorted data
export function getTopNDamageDealers(sortedData: GuildRaidResult[], n: number) {
    return sortedData.slice(0, n).map((player, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
        const formattedDamage = player.totalDamage.toLocaleString();
        return `${medal} ${player.username}: ${formattedDamage}`;
    });
}

export function sortGuildRaidResultDesc(data: GuildRaidResult[]) {
    return data.sort((a, b) => b.totalDamage - a.totalDamage);
}

export function sortTokensUsed(data: TokensUsed[]) {
    return data.sort((a, b) => b.tokens - a.tokens);
}

export function getUnixTimestamp(date: Date) {
    return Math.floor(date.getTime() / 1000);
}

export function evaluateToken(
    token: TokenStatus,
    timestampInSeconds: number
): TokenStatus {
    const twelveHoursInSeconds = 12 * 60 * 60;
    const maxTokens = 3;
    const nRecharged = Math.floor(
        (timestampInSeconds - token.refreshTime) / twelveHoursInSeconds
    );

    if (nRecharged + token.count >= maxTokens) {
        token.count = maxTokens;
        token.refreshTime = timestampInSeconds;
    } else {
        token.count += nRecharged;
        token.refreshTime += nRecharged * twelveHoursInSeconds;
    }

    return token;
}

export function SecondsToString(
    timestampInSeconds: number,
    hideDays: boolean = false
): string {
    const secondsPerDay = 24 * 3600;
    const days = Math.floor(timestampInSeconds / secondsPerDay);
    const remAfterDays = timestampInSeconds % secondsPerDay;

    let hours: number | string;
    let minutes: string;
    let seconds: string;
    let daysPart = "";

    if (hideDays) {
        // All hours, no days part
        hours = Math.floor(timestampInSeconds / 3600)
            .toString()
            .padStart(2, "0");
        const remAfterHours = timestampInSeconds % 3600;
        minutes = Math.floor(remAfterHours / 60)
            .toString()
            .padStart(2, "0");
        seconds = (remAfterHours % 60).toString().padStart(2, "0");
    } else {
        hours = Math.floor(remAfterDays / 3600)
            .toString()
            .padStart(2, "0");
        const remAfterHours = remAfterDays % 3600;
        minutes = Math.floor(remAfterHours / 60)
            .toString()
            .padStart(2, "0");
        seconds = (remAfterHours % 60).toString().padStart(2, "0");
        daysPart = days > 0 ? `${days}d ` : "";
    }

    return `${daysPart}${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Checks if the cooldown is within the next hour.
 * @param cooldown The cooldown string in a specific bot-related format (xxHyyM) (e.g., "01h30m").
 * @returns True if the cooldown is within the next hour, false otherwise.
 */
export function withinNextHour(cooldown: string): boolean {
    cooldown.slice(1);

    const num = Number(cooldown.slice(0, 2));

    return num < 1;
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

export function isValidUUIDv4(uuid: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

export function numericMedian(arr: number[]): number {
    if (arr.length === 0) return 0;

    const sorted = [...arr].sort((a, b) => a - b);
    const middleIndex = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middleIndex - 1]! + sorted[middleIndex]!) / 2;
    } else {
        return sorted[middleIndex]!;
    }
}

export function numericAverage(arr: number[]): number {
    if (arr.length === 0) return 0;

    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
}

export function standardDeviation(arr: number[]): number {
    if (arr.length === 0) return 0;

    const mean = numericAverage(arr);
    const squaredDiffs = arr.map((value) => Math.pow(value - mean, 2));
    const variance = numericAverage(squaredDiffs);
    return Math.sqrt(variance);
}

export function getBossEmoji(boss: string) {
    // Remove first two chracters
    const words = splitByCapital(boss);
    const identifier = words.at(0)?.toLowerCase();
    if (!identifier) {
        return "❓";
    }

    boss = boss.toLowerCase();

    if (boss.includes("szarekh")) {
        return BOSS_EMOJIS.Szarekh || "❓";
    } else if (boss.includes("tervigon")) {
        const version = words.at(1)?.toLowerCase();
        if (version === "leviathan") return BOSS_EMOJIS.TyrantLeviathan || "❓";
        if (version === "gorgon") return BOSS_EMOJIS.TyrantGorgon || "❓";
        if (version === "kronos") return BOSS_EMOJIS.TyrantKronos || "❓";
    } else if (boss.includes("hive")) {
        const version = words.at(2)?.toLowerCase();
        if (version === "leviathan") return BOSS_EMOJIS.TyrantLeviathan || "❓";
        if (version === "gorgon") return BOSS_EMOJIS.TyrantGorgon || "❓";
        if (version === "kronos") return BOSS_EMOJIS.TyrantKronos || "❓";
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

export const UnitIdNameMapping: Record<string, string> = {
    // Ultramarines
    ultraTigurius: "Tigurius",
    ultraInceptorSgt: "Bellator",
    ultraEliminatorSgt: "Certus",
    ultraApothecary: "Incisus",
    ultraTitus: "Titus",
    ultraCalgar: "Calgar",

    // Sisters of Battle
    adeptRetributor: "Vindicta",
    adeptHospitaller: "Isabella",
    adeptCanoness: "Roswitha",
    adeptCelestian: "Celestine",

    // Necrons
    necroWarden: "Makhotep",
    necroDestroyer: "Imospekh",
    necroSpyder: "Aleph-Null",
    necroPlasmancer: "Thutmose",
    necroOverlord: "Anuphet",

    // Death guard
    deathBlightlord: "Maladus",
    deathBlightbringer: "Corrodius",
    deathRotbone: "Rotbone",
    deathPutrifier: "Pestillian",

    // Aeldari
    eldarRanger: "Calandis",
    eldarFarseer: "Eldryon",
    eldarAutarch: "Aethana",

    // Orks
    orksBigMek: "Gibbascrapz",
    orksRuntherd: "Snotflogga",
    orksWarboss: "Gulgortz",
    orksKillaKan: "Snappawrecka",
    orksNob: "Tanksmasha",

    // Black Legion
    blackTerminator: "Angrax",
    blackHaarken: "Haarken",
    blackPossession: "Archimatos",
    blackObliterator: "Volk",

    // Tyranids
    tyranTyrantGuard: "Tyrant Guard",
    tyranNeurothrope: "Neurothrope",
    tyranWingedPrime: "Winged Prime",
    tyranDeathleaper: "Deathleaper",
    tyranParasite: "Parasite of Mortrex",

    // Astra Militarum
    astraYarrick: "Yarrick",
    astraPrimarisPsy: "Sibyll",
    astraBullgryn: "Kut",
    astraOrdnance: "Thaddeus",

    // Blood angels
    bloodSanguinaryPriest: "Nicodemus",
    bloodMephiston: "Mephiston",
    bloodDante: "Dante",
    bloodIntercessor: "Mataneo",
    bloodDeathCompany: "Lucien",

    // Space wolves
    spaceHound: "Tjark",
    spaceBlackmane: "Ragnar",
    spaceWulfen: "Ulf",
    spaceStormcaller: "Njal",
    spaceRockfist: "Arjac",

    // Thousand sons
    thousTzaangor: "Yazaghor",
    thousAhriman: "Ahriman",
    thousInfernalMaster: "Abraxas",
    thousTerminator: "Toth",

    // Adeptus Mechanicus
    admecRuststalker: "Exitor-Rho",
    admecManipulus: "Actus",
    admecMarshall: "Tan Gi'da",
    admecDominus: "Vitruvius",
    admecDestroyer: "Sy-gex",

    // World Eaters
    worldKharn: "Kharn",
    worldTerminator: "Wrask",
    worldJakhal: "Jakhal",
    worldEightbound: "Azkor",
    worldExecutions: "Tarvakh",

    // Black Templars
    templSwordBrother: "Godswyl",
    templHelbrecht: "Helbrecht",
    templAggressor: "Burchard",
    templAncient: "Thoread",
    templChampion: "Jaeger",

    // Dark Angels
    darkaAsmodai: "Asmodai",
    darkaCompanion: "Forcas",
    darkaTerminator: "Baraqiel",
    darkaAzrael: "Azrael",
    darkaHellblaster: "Sarquael",

    // Custodes
    custoVexilusPraetor: "Aesoth",
    custoAtlacoya: "Atlacoya",
    custoTrajann: "Trajann",
    custoBladeChampion: "Kariyan",
    custoAllarus: "Allarus",

    // Tau
    tauMarksman: "Sho'syl",
    tauCrisis: "Re'vas",
    tauAunShi: "Aun'shi",
    tauDarkstrider: "Darkstrider",

    // Genestealers
    genesMagus: "Xybia",
    genesBiophagus: "Hollan",
    genesPrimus: "Isaak",
    genesPatriarch: "Patermine",
    genesKelermorph: "Judh",

    // Machines of War
    astraOrdnanceBattery: "Malleus",
    blackForgefiend: "Forgefiend",
    ultraDreadnought: "Galatian",
    tyranBiovore: "Biovore",
    deathCrawler: "Plagueburst",
    adeptExorcist: "Exorcist",

    // Emperor's Children
    emperNoiseMarine: "Shiron",
    emperLucius: "Lucius",
};

export function mapUnitIdToName(unitTid: string): string {
    if (UnitIdNameMapping[unitTid]) {
        return UnitIdNameMapping[unitTid];
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
