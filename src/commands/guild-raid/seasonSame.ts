import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-same")
    .setDescription("Get previous GR seasons with the same config")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number to check")
            .setRequired(true)
            .setMinValue(70)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});

    const discordId = interaction.user.id;
    const season = interaction.options.getNumber("season", true);

    const guildService = new GuildService();

    try {
        const matches = await guildService.getSeasonsWithSameConfig(
            discordId,
            5,
            season
        );

        if (!matches) {
            await interaction.editReply({
                content:
                    "Could not fetch data for you. Ensure your token is valid.",
            });
            return;
        }

        if (matches.length === 0) {
            await interaction.editReply({
                content: `No previous seasons found with the same config as season ${season}.`,
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Guild raid seasons with the same config`)
            .setTimestamp()
            .setFields(
                { name: "Your selected season", value: `${season}` },
                {
                    name: `Seasons`,
                    value: matches.join(", "),
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(
            error,
            `Error while executing /season-configs command for ${interaction.user.username}`
        );
    }
}
