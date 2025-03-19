import { Events } from "discord.js";

export const name = Events.ClientReady;
export const once = true;
export async function execute(client: any) {
  console.log(`Ready! Logged in as ${client.user.tag}`);
}
