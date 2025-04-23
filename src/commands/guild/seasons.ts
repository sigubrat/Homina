import { SlashCommandBuilder } from "discord.js";
import { GuildService } from "../../lib/services/guildService";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("seasons")
    .setDescription("Get the available guild raid seasons for your guild");

export async function execute(interaction: any) {
    await interaction.deferReply();

    const service = new GuildService();

    console.log("Seasons - Waiting for result...");
    const result = await service.getGuildSeasons(interaction.user.id);
    console.log("Seasons - Result:", result);

    if (result == null) {
        await interaction.editReply({
            content:
                "Could not fetch guild seasons. Ensure you are registered and have the correct permissions",
        });
    } else if (result.length === 0) {
        await interaction.editReply({
            content: "No seasons available for your guild",
        });
    } else {
        await interaction.editReply({
            content: `Available seasons for your guild: ${result.join(", ")}`,
        });
    }
}
