import {
    Client,
    GatewayIntentBits,
    Collection,
    ActivityType,
} from "discord.js";
import * as path from "path";
import * as fs from "fs";
import { dbController, logger, validateEnvVars } from "@/lib";
import { getAllCommands } from "@/lib/utils/commandUtils";
import { InfisicalClient } from "@/client/InfisicalClient";
import { MessageService } from "@/lib/services/MessageService";

export class IClient extends Client {
    commands = new Collection<string, any>();
    cooldowns = new Collection<string, Collection<string, number>>();
}

console.log("Starting Discord bot...");

const client = new IClient({
    intents: [GatewayIntentBits.Guilds],
    presence: {
        activities: [
            {
                type: ActivityType.Custom,
                name: "Worshiping the machine spirit",
            },
        ],
        status: "online",
    },
});

// Load commands and start the bot
const startBot = async () => {
    try {
        // Fetch secrets from Infisical
        const infisicalClient = new InfisicalClient();
        await infisicalClient.init();
        await infisicalClient.fetchSecrets();
        const messageService = new MessageService(client);

        // Check database connection
        const res = await dbController.isReady();
        if (!res.isSuccess) {
            logger.error(res.message, "Database test failed");
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

        client.user?.setActivity("test", { type: ActivityType.Custom });

        // Log in to Discord
        await client.login(process.env.BOT_TOKEN!);
        logger.info("Bot logged in successfully.");

        // Schedule token cleanup every 24 hours
        const runCleanup = async () => {
            logger.info("Running token cleanup...");
            try {
                const deletedIds = await dbController.cleanupOldTokens();

                if (deletedIds.length > 0) {
                    for (const userId of deletedIds) {
                        await messageService.alertDeletedUser(userId);
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000),
                        ); // 1 second delay
                    }
                }
                logger.info("Token cleanup completed successfully.");
            } catch (error) {
                logger.error(error, "Error during token cleanup:");
            }
        };

        await runCleanup(); // Run once on startup
        setInterval(runCleanup, 24 * 60 * 60 * 1000);
    } catch (error) {
        logger.error(error, "Error starting the bot:");
        process.exit(1); // Exit the process if there's a critical error
    }
};

// Start the bot
startBot();
