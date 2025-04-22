import * as fs from "fs/promises";
import * as path from "path";
import { Collection } from "discord.js";
import HominaHttpClient from "../../../common/src/client/tacticus-client";

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

    let commandsCollection = new Collection<string, any>();
    for (const category of categoryDirs) {
        const commandsPath = path.join(commandsRoot, category);
        const commands = await getCommands(commandsPath);
        commands.forEach((cmd, key) => commandsCollection.set(key, cmd));
    }
    return commandsCollection;
}

export async function testApiToken(token: string): Promise<boolean> {
    try {
        const client = new HominaHttpClient();

        const resp = await client.getGuild(token);

        return resp.success;
    } catch (error) {
        console.error("Error testing API token:", error);
        return false;
    }
}
