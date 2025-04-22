import { SlashCommandBuilder } from "discord.js";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!");

export async function execute(interaction: any) {
    await interaction.reply("Pong!");
}
