import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
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
            .setDescription(
                "The season number to check (defaults to current season)"
            )
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});

    const discordId = interaction.user.id;
    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

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
                {
                    name: "Your selected season",
                    value:
                        providedSeason === null
                            ? `Current (${season})`
                            : `${season}`,
                },
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
