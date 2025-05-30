import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
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
            const embed = new EmbedBuilder()
                .setColor("#0099ff")
                .setTitle("Available Guild Raid Seasons")
                .setDescription(
                    `Fetches the seasons your guild has available data for. The public API does not include data pre season 70.`
                )
                .addFields([
                    {
                        name: "Current season",
                        value:
                            result[result.length - 1]?.toString() ??
                            "Something went wrong...",
                        inline: true,
                    },
                    {
                        name: "Seasons",
                        value: result.join(", "),
                        inline: false,
                    },
                ])
                .setFooter({
                    text: "Note: Snowprint may not return all seasons due to a known API bug.",
                });

            await interaction.editReply({
                embeds: [embed],
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
