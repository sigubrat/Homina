import { Client, GatewayIntentBits, Collection } from "discord.js";
import * as path from "path";
import * as fs from "fs";
import { getCommands } from "./lib";

export class IClient extends Client {
    commands = new Collection<string, any>();
    cooldowns = new Collection<string, Collection<string, number>>();
}

const token = process.env.BOT_TOKEN;

if (!token) {
    console.error(
        "No token provided. Please set the BOT_TOKEN environment variable in your .env file."
    );
    process.exit(1);
}

console.log("Starting Discord bot...");

const client = new IClient({
    intents: [GatewayIntentBits.Guilds],
});

// Load commands and start the bot

const commandsPath = path.join(__dirname, "commands/utility");

const startBot = async () => {
    try {
        const commands = await getCommands(commandsPath);
        commands.forEach((command) => {
            client.commands.set(command.data.name, command);
        });

        console.log("Commands loaded successfully.");

        // Set up event listeners
        const eventsPath = path.join(__dirname, "events");
        const eventFiles = fs
            .readdirSync(eventsPath)
            .filter((file) => file.endsWith(".ts"));

        for (const file of eventFiles) {
            const filePath = path.join(eventsPath, file);
            const event = await import(filePath);
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args));
            } else {
                client.on(event.name, (...args) => event.execute(...args));
            }
        }

        // Log in to Discord
        await client.login(token);
        console.log("Bot logged in successfully.");
    } catch (error) {
        console.error("Error starting the bot:", error);
        process.exit(1); // Exit the process if there's a critical error
    }
};

// Start the bot
startBot();
