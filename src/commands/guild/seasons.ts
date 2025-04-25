import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { GuildService } from "../../lib/services/GuildService";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("seasons")
    .setDescription("Get the available guild raid seasons for your guild");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();
    try {
        const result = await service.getGuildSeasons(interaction.user.id);

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
                content: `Available seasons for your guild: ${result.join(
                    ", "
                )}`,
            });
        }
    } catch (error) {
        console.error("Error fetching guild seasons: ", error);
        await interaction.editReply({
            content: "An error occurred while fetching guild seasons.",
        });
    }
}
