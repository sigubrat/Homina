import * as fs from "fs/promises";
import * as path from "path";
import { Collection } from "discord.js";
import { HominaTacticusClient } from "@/client";

/**
 * Asynchronously loads command modules from a specified directory and returns them in a collection.
 *
 * This function reads all files in the given `commandsPath` directory, imports each file ending with `.ts` or `.js`,
 * and adds the command to a collection if it contains a `data` property with a `name`.
 *
 * @param commandsPath - The path to the directory containing command files.
 * @returns A promise that resolves to a `Collection` mapping command names to their respective command modules.
 */
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

/**
 * Asynchronously retrieves all command modules from categorized directories and aggregates them into a single collection.
 *
 * This function scans the `commands` directory, iterates through each category subdirectory,
 * loads the commands using `getCommands`, and combines them into a `Collection`.
 *
 * @returns {Promise<Collection<string, any>>} A promise that resolves to a collection containing all loaded commands, keyed by their identifiers.
 * @throws Will throw an error if reading directories or loading commands fails.
 */
export async function getAllCommands(): Promise<Collection<string, any>> {
    try {
        const commandsRoot = path.join(__dirname, "../../commands");
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

/**
 * Tests the validity of an API token by attempting to retrieve guild information.
 *
 * @param token - The API token to be tested.
 * @returns A promise that resolves to `true` if the token is valid, or `false` otherwise.
 */
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

/**
 * Tests the validity of a Player API token by attempting to retrieve player information.
 *
 * @param token - The Player API token to be tested.
 * @returns A promise that resolves to `true` if the token is valid, or `false` otherwise.
 */
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
