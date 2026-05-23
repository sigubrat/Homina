import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_HEADER,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { linearRegression } from "@/lib/utils/mathUtils";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("tokens-per-loop")
    .setDescription(
        "Show how many tokens the guild spent on each loop in a given season",
    )
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season to check (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();
    const discordId = interaction.user.id;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /tokens-per-loop for season ${season}`,
    );

    try {
        const tokensPerLoop = await service.getTokensPerLoopBySeason(
            discordId,
            season,
        );

        if (!tokensPerLoop || Object.keys(tokensPerLoop).length === 0) {
            await interaction.editReply({
                content: `No data found for season ${season}. Please make sure you have registered your API-token.`,
            });
            return;
        }

        const loopNumbers = Object.keys(tokensPerLoop)
            .map(Number)
            .sort((a, b) => a - b);

        const loopLabels = loopNumbers.map((n) => `Loop ${n}`);
        const tokenValues = loopNumbers.map((n) => tokensPerLoop[n] ?? 0);

        // Exclude the last loop (potentially in-progress) from the regression
        // fit, but still extrapolate the trendline across all plotted points.
        const fitValues = tokenValues.slice(0, -1);
        const trendline =
            fitValues.length >= 2
                ? linearRegression(fitValues, tokenValues.length)
                : undefined;

        let trendPct: string | undefined;
        if (trendline && trendline[0]! !== 0) {
            const change =
                ((trendline[trendline.length - 1]! - trendline[0]!) /
                    trendline[0]!) *
                100;
            trendPct = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
        }

        const chartService = new ChartService();
        const chartBuffer = await chartService.createSeasonalTrendChart(
            tokenValues,
            loopLabels,
            `Tokens spent per loop — Season ${season}`,
            {
                seriesLabel: "Tokens used",
                yAxisLabel: "Tokens used",
                integerTicks: true,
                trendline,
            },
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "tokens-per-loop.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Tokens spent per loop — Season ${season}`)
            .setDescription(
                `Total guild tokens spent on each loop in season **${season}** (${loopNumbers.length} loop${loopNumbers.length !== 1 ? "s" : ""} found).\n` +
                    "- Each non-bomb attack costs one token.\n" +
                    "- A loop is completed each time the cap boss is defeated.\n" +
                    (trendline !== undefined
                        ? `- **Trend:** ${
                              trendline[trendline.length - 1]! >= trendline[0]!
                                  ? "↗️ increasing"
                                  : "↘️ decreasing"
                          }${trendPct ? ` (${trendPct})` : ""} (linear regression)\n`
                        : ""),
            )
            .setImage("attachment://tokens-per-loop.png")
            .setTimestamp()
            .setFooter({
                text: STANDARD_HEADER,
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /tokens-per-loop for season ${season}`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in tokens-per-loop: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the tokens per loop chart.",
        });
        return;
    }
}
