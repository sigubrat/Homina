import { logger } from "@/lib";
import { STANDARD_HEADER } from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { linearRegression } from "@/lib/utils/mathUtils";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

const DEFAULT_SEASONS = 5;
const MIN_SEASONS = 2;
const MAX_SEASONS = 20;

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("loops-history")
    .setDescription(
        "Show how many guild raid loops the guild has completed over the last N seasons",
    )
    .addNumberOption((option) =>
        option
            .setName("seasons")
            .setDescription(
                `Number of past seasons to include (default: ${DEFAULT_SEASONS})`,
            )
            .setRequired(false)
            .setMinValue(MIN_SEASONS)
            .setMaxValue(MAX_SEASONS),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const nSeasons =
        interaction.options.getNumber("seasons") ?? DEFAULT_SEASONS;

    const discordId = interaction.user.id;
    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /loops-history over last ${nSeasons} seasons`,
    );

    try {
        const loopsBySeason = await service.getLoopsCompletedInLastSeasons(
            discordId,
            nSeasons,
        );

        if (!loopsBySeason || Object.keys(loopsBySeason).length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified seasons. Please make sure you have registered your API-token.",
            });
            return;
        }

        const seasonNumbers = Object.keys(loopsBySeason)
            .map(Number)
            .sort((a, b) => a - b);

        const seasonLabels = seasonNumbers.map((s) => `S${s}`);

        const loopValues = seasonNumbers.map(
            (season) => loopsBySeason[season] ?? 0,
        );

        // Exclude the last season (current, in-progress) from the regression
        // fit, but still extrapolate the trendline across all plotted points.
        const fitValues = loopValues.slice(0, -1);
        const trendline =
            fitValues.length >= 2
                ? linearRegression(fitValues, loopValues.length)
                : undefined;

        const chartService = new ChartService();
        const chartBuffer = await chartService.createSeasonalTrendChart(
            loopValues,
            seasonLabels,
            "Guild raid loops completed",
            {
                seriesLabel: "Loops completed",
                yAxisLabel: "Loops completed",
                integerTicks: true,
                trendline,
            },
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "laps-by-season.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Guild raid loops completed — last ${seasonNumbers.length} seasons`,
            )
            .setDescription(
                `Loops completed per season (${seasonNumbers[0]}–${seasonNumbers[seasonNumbers.length - 1]}).\n` +
                    "- A loop is counted each time the **Mythic 2** boss is defeated.\n" +
                    "- Seasons with no completed loops show as **0**.\n" +
                    (trendline !== undefined
                        ? `- **Trend:** ${
                              trendline[trendline.length - 1]! >= trendline[0]!
                                  ? "↗️ increasing"
                                  : "↘️ decreasing"
                          } (linear regression, current season excluded)\n`
                        : ""),
            )
            .setImage("attachment://laps-by-season.png")
            .setTimestamp()
            .setFooter({
                text: STANDARD_HEADER,
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /loops-history for last ${nSeasons} seasons`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in loops-history: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the loops by season chart.",
        });
        return;
    }
}
