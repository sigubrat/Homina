import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("server")
  .setDescription("Get server information");
export async function execute(interaction: any) {
  await interaction.reply(
    `This server is ${interaction.guild.name} and has ${interaction.guild.memberCount} members.`
  );
}
