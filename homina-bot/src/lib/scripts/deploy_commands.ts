import { REST } from "@discordjs/rest";
import { Collection, Routes } from "discord.js";
import { getAllCommands } from "../utils";
import readline from "readline";

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
        /**  Prompt the user for scope (guild/global)
         *   Guild-based deployment is faster, but the commands will only be available in the specified guild
         *   Global deployment can take up to an hour, but the commands will be available in all servers
         */
        let scope: string;
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        const answer = await new Promise<string>((res) =>
            rl.question("Deploy to (guild/global) [guild]: ", res)
        );
        rl.close();
        scope = answer.trim().toLowerCase() === "global" ? "global" : "guild";
        console.log(`Chosen scope: ${scope}`);

        let commandsCollection = await getAllCommands();

        const commands = Array.from(commandsCollection.values()).map(
            (command) => command.data
        );

        const rest = new REST({ version: "10" }).setToken(token);

        console.log("Started refreshing application (/) commands.");

        console.log(
            "Commands to be deployed:",
            commands.map((cmd) => cmd.name)
        );

        const routes =
            scope === "global"
                ? Routes.applicationCommands(clientId)
                : Routes.applicationGuildCommands(clientId, guildId);

        const resp = (await rest.put(routes, {
            body: commands,
        })) as any[];

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
