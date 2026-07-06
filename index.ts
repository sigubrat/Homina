import { GatewayIntentBits, ActivityType } from "discord.js";
import * as path from "path";
import * as fs from "fs";
import { dbController, logger, validateEnvVars } from "@/lib";
import { getAllCommands } from "@/lib/utils/commandUtils";
import { InfisicalClient } from "@/client/InfisicalClient";
import { FatalError } from "@/models/errors/FatalError";
import { CleanupJob } from "@/lib/jobs/CleanupJob";
import { ScheduledCommandsJob } from "@/lib/jobs/ScheduledCommandsJob";
import { IClient } from "@/models/types/IClient";

console.log("Starting Discord bot...");

// Suppress croner's benign `TimeoutNegativeWarning` — croner internally arms
// its next tick via setTimeout and can land 1 ms behind `now` due to ms
// rounding on cron-boundary constructions (e.g. `* * * * *`). It clamps to
// 1 ms and fires correctly; the warning is cosmetic. All other warnings are
// still forwarded to the default handler so we don't hide real issues.
process.on("warning", (warning) => {
    if (
        warning.name === "TimeoutNegativeWarning" &&
        warning.stack?.includes("croner")
    ) {
        return;
    }
    console.warn(warning);
});

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
        // Validate middleware env variable
        validateEnvVars(["MIDDLEWARE_URL"]);

        // Fetch secrets from Infisical
        const infisicalClient = new InfisicalClient();
        await infisicalClient.init();
        await infisicalClient.fetchSecrets();

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

        // Start scheduled cleanup job
        const cleanupJob = new CleanupJob(client);
        cleanupJob.start();

        // Start scheduled commands job
        const scheduledCommandsJob = new ScheduledCommandsJob(client);
        await scheduledCommandsJob.start();
    } catch (error) {
        if (error instanceof FatalError) {
            console.error(`Fatal: ${error.message}`);
        } else {
            logger.error(error, "Error starting the bot:");
        }
        process.exit(1);
    }
};

// Start the bot
startBot();
