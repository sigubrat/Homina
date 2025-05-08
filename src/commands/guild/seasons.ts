import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { GuildService } from "../../lib/services/GuildService";
import { logger } from "@/lib";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("seasons")
    .setDescription("Get the available guild raid seasons for your guild");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();

    logger.info(`${interaction.user.username} attempting to use /seasons`);

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
                )} (Nb! Snowprint seems to have a bug with the API where it doesn't return all seasons)`,
            });
        }

        logger.info(`${interaction.user.username} used /seasons`);
    } catch (error) {
        logger.error(error, "Error fetching guild seasons");
        await interaction.editReply({
            content: "An error occurred while fetching guild seasons.",
        });
    }
}
