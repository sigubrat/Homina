import {
  Client,
  Events,
  GatewayIntentBits,
  Collection,
  MessageFlags,
} from "discord.js";
import * as path from "path";
import { loadCommands } from "./lib";

class IClient extends Client {
  commands = new Collection<string, any>();
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
    const commands = await loadCommands(commandsPath);
    commands.forEach((command) => {
      client.commands.set(command.data.name, command);
    });

    console.log("Commands loaded successfully.");

    // Set up event listeners
    client.once(Events.ClientReady, (readyClient) => {
      console.log(`Logged in as ${readyClient.user.tag}`);
    });

    // Log in to Discord
    await client.login(token);
    console.log("Bot logged in successfully.");

    client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return; // Ignore non-chat input commands

      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`
        );
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "There was an error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.reply({
            content: "There was an error while executing this command!",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    });
  } catch (error) {
    console.error("Error starting the bot:", error);
    process.exit(1); // Exit the process if there's a critical error
  }
};

// Start the bot
startBot();
