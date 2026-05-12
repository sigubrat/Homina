import { logger } from "@/lib";
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

const CREDITS_PER_BOSS_LEGACY = 300;
const CREDITS_PER_BOSS = 1000;
const LEGACY_SEASON_THRESHOLD = 81;

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("guild-credits-history")
    .setDescription(
        "Show how many credits the guild has earned from killing guild bosses over the last N seasons",
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
        `${interaction.user.username} attempting to use /guild-credits-history over last ${nSeasons} seasons`,
    );

    try {
        const bossesBySeason = await service.getBossesKilledInLastSeasons(
            discordId,
            nSeasons,
        );

        if (!bossesBySeason || Object.keys(bossesBySeason).length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified seasons. Please make sure you have registered your API-token.",
            });
            return;
        }

        const seasonNumbers = Object.keys(bossesBySeason)
            .map(Number)
            .sort((a, b) => a - b);

        const seasonLabels = seasonNumbers.map((s) => `S${s}`);

        const creditsValues = seasonNumbers.map(
            (season) =>
                (bossesBySeason[season] ?? 0) *
                (season <= LEGACY_SEASON_THRESHOLD
                    ? CREDITS_PER_BOSS_LEGACY
                    : CREDITS_PER_BOSS),
        );

        // Exclude the last season (current, in-progress) from the regression
        // fit, but still extrapolate the trendline across all plotted points.
        const fitValues = creditsValues.slice(0, -1);
        const trendline =
            fitValues.length >= 2
                ? linearRegression(fitValues, creditsValues.length)
                : undefined;

        const chartService = new ChartService();
        const chartBuffer = await chartService.createCreditsBySeasonChart(
            creditsValues,
            seasonLabels,
            "Credits earned from guild bosses",
            trendline,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "credits-by-season.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Credits earned from guild bosses — last ${seasonNumbers.length} seasons`,
            )
            .setDescription(
                `Credits earned per season (${seasonNumbers[0]}–${seasonNumbers[seasonNumbers.length - 1]}).\n` +
                    `- Each guild boss kill awards **${CREDITS_PER_BOSS.toLocaleString()}** credits (S${LEGACY_SEASON_THRESHOLD} and earlier: **${CREDITS_PER_BOSS_LEGACY.toLocaleString()}**).\n` +
                    "- Seasons with no kills show as **0**.\n" +
                    "- Graph does not include the end-of-season leaderboard rewards, only credits earned from boss kills.\n" +
                    (trendline !== undefined
                        ? `- **Trend:** ${
                              trendline[trendline.length - 1]! >= trendline[0]!
                                  ? "↗️ increasing"
                                  : "↘️ decreasing"
                          } (linear regression)\n`
                        : ""),
            )
            .setImage("attachment://credits-by-season.png")
            .setTimestamp()
            .setFooter({
                text: "Referral code: HUG-44-CAN if you want to support the bot development",
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /guild-credits-history for last ${nSeasons} seasons`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in credits-by-season: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the credits by season chart.",
        });
        return;
    }
}
