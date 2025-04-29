import * as fs from "fs/promises";
import * as path from "path";
import { Collection } from "discord.js";
import { HominaTacticusClient } from "@/client";
import type { GuildRaidResult } from "@/models/types";

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
                console.log(`Loaded command: ${command.data.name}`);
            } else {
                console.warn(`Skipping file: ${file} (missing data or name)`);
            }
        }
    }

    return commandsCollection;
}

export async function getAllCommands(): Promise<Collection<string, any>> {
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
};

const NAMED_COLORS = [
    CHART_COLORS.red,
    CHART_COLORS.orange,
    CHART_COLORS.yellow,
    CHART_COLORS.green,
    CHART_COLORS.blue,
    CHART_COLORS.purple,
    CHART_COLORS.grey,
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
    "tauCrisis", // Re'vas
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

// Nb! Relies on the user providing sorted data
export function getTopDamageDealers(sortedData: GuildRaidResult[]) {
    return sortedData.map((player, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
        return `${medal} ${player.username}: ${player.totalDamage}`;
    });
}
