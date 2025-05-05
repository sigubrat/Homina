import { Client, GatewayIntentBits, Collection } from "discord.js";
import * as path from "path";
import * as fs from "fs";
import { dbController, logger } from "@/lib";
import { getAllCommands } from "@/lib/utils";

export class IClient extends Client {
    commands = new Collection<string, any>();
    cooldowns = new Collection<string, Collection<string, number>>();
}

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPwd = process.env.DB_PWD;

const missingVars = [];
if (!token) missingVars.push("BOT_TOKEN");
if (!clientId) missingVars.push("CLIENT_ID");
if (!guildId) missingVars.push("GUILD_ID");
if (!dbName) missingVars.push("DB_NAME");
if (!dbUser) missingVars.push("DB_USER");
if (!dbPwd) missingVars.push("DB_PWD");

if (missingVars.length > 0) {
    console.error(
        `Missing environment variables: ${missingVars.join(
            ", "
        )}. Please ensure all required variables are set.`
    );
    process.exit(1);
}

console.log("Starting Discord bot...");

const client = new IClient({
    intents: [GatewayIntentBits.Guilds],
});

// Load commands and start the bot
const startBot = async () => {
    try {
        // Check database connection
        const res = await dbController.isReady();
        if (!res.isSuccess) {
            console.error(
                "Database test failed with error message: ",
                res.message
            );
            process.exit(1);
        }

        const commands = await getAllCommands();
        commands.forEach((command) => {
            client.commands.set(command.data.name, command);
        });

        console.log("Commands loaded successfully.");

        // Set up event listeners
        const eventsPath = path.join(__dirname, "src/events");
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
        logger.info("Bot logged in successfully.");
    } catch (error) {
        console.error("Error starting the bot:", error);
        process.exit(1); // Exit the process if there's a critical error
    }
};

// Start the bot
startBot();
