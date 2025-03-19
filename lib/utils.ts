import * as fs from "fs/promises";
import * as path from "path";
import { Collection } from "discord.js";

export async function getCommands(
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
