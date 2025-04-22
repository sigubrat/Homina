import { REST } from "@discordjs/rest";
import { Routes } from "discord.js";
import { getCommands } from "../../../common/src/lib/utils";
import * as path from "path";

const commandsPath = path.join(__dirname, "../../commands/utility");
const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
    console.error(
        "Missing environment variables: BOT_TOKEN, CLIENT_ID, or GUILD_ID."
    );
    process.exit(1);
}

const deployCommands = async () => {
    try {
        const commandsCollection = await getCommands(commandsPath);

        console.log(
            `Loaded ${commandsCollection.size} commands from ${commandsPath}`
        );

        const commands = Array.from(commandsCollection.values()).map(
            (command) => command.data
        );

        const rest = new REST({ version: "10" }).setToken(token);

        console.log("Started refreshing application (/) commands.");

        console.log(
            "Commands to be deployed:",
            commands.map((cmd) => cmd.name)
        );

        const resp = (await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            {
                body: commands,
            }
        )) as any[];

        console.log("Discord updated", resp.length, "commands.");

        if (resp.length === commands.length) {
            console.log("\x1b[32mAll commands deployed successfully.\x1b[0m");
        } else {
            console.error(
                `\x1b[31mWarning: Expected ${commands.length} commands, but got ${resp.length}.\x1b[0m`
            );
        }
    } catch (error) {
        console.error("Error deploying commands:", error);
    }
};

deployCommands();
