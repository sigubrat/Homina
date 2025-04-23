import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("user")
    .setDescription("Get user information");
export async function execute(interaction: any) {
    await interaction.reply(
        `User: ${interaction.user.username}\nID: ${interaction.user.id}`
    );
}
