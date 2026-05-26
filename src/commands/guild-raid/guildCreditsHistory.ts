import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { linearRegression } from "@/lib/utils/mathUtils";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
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

const ORB_VALUE_BY_RARITY: Partial<Record<Rarity, number>> = {
    [Rarity.COMMON]: 0,
    [Rarity.UNCOMMON]: 90,
    [Rarity.RARE]: 210,
    [Rarity.EPIC]: 495,
    [Rarity.LEGENDARY]: 1200,
    [Rarity.MYTHIC]: 2700,
};

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
    )
    .addNumberOption((option) =>
        option
            .setName("starting-season")
            .setDescription("Start from this season instead of the current one")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    )
    .addBooleanOption((option) =>
        option
            .setName("old-comparison")
            .setDescription(
                "Show a red line comparing the old system value (credits + orbs). Default: False",
            )
            .setRequired(false),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const nSeasons =
        interaction.options.getNumber("seasons") ?? DEFAULT_SEASONS;
    const startingSeason =
        interaction.options.getNumber("starting-season") ?? undefined;

    if (startingSeason !== undefined && isInvalidSeason(startingSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const showOldComparison =
        interaction.options.getBoolean("old-comparison") ?? false;

    const discordId = interaction.user.id;
    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /guild-credits-history over last ${nSeasons} seasons`,
    );

    try {
        const bossesByRarity = await service.getBossesKilledInLastSeasons(
            discordId,
            nSeasons,
            startingSeason,
        );

        if (!bossesByRarity || Object.keys(bossesByRarity).length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified seasons. Please make sure you have registered your API-token.",
            });
            return;
        }

        const seasonNumbers = Object.keys(bossesByRarity)
            .map(Number)
            .sort((a, b) => a - b);

        const seasonLabels = seasonNumbers.map((s) => `S${s}`);

        const creditsValues = seasonNumbers.map((season) => {
            const rarityMap = bossesByRarity[season] ?? {};
            const totalKills = Object.values(rarityMap).reduce(
                (sum, n) => sum + (n ?? 0),
                0,
            );
            return (
                totalKills *
                (season <= LEGACY_SEASON_THRESHOLD
                    ? CREDITS_PER_BOSS_LEGACY
                    : CREDITS_PER_BOSS)
            );
        });

        // Calculate old-system total value per season:
        // 300 credits per boss + orb value based on rarity
        const oldSystemValues = seasonNumbers.map((season) => {
            const rarityMap = bossesByRarity[season] ?? {};
            let totalValue = 0;
            for (const [rarity, count] of Object.entries(rarityMap)) {
                const orbValue = ORB_VALUE_BY_RARITY[rarity as Rarity] ?? 0;
                totalValue +=
                    (count ?? 0) * (CREDITS_PER_BOSS_LEGACY + orbValue);
            }
            return totalValue;
        });

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
            showOldComparison
                ? {
                      values: oldSystemValues,
                      label: "Old system value (credits + orbs)",
                  }
                : undefined,
        );

        // Calculate percentage increase per season from the trendline
        const trendPctPerSeason =
            trendline !== undefined &&
            trendline.length >= 2 &&
            trendline[0] !== 0
                ? ((trendline[trendline.length - 1]! - trendline[0]!) /
                      (trendline.length - 1) /
                      trendline[0]!) *
                  100
                : undefined;

        // Calculate average percentage difference between old and new system
        // Only include seasons after the legacy threshold (S82+)
        const avgOldDiffPct = showOldComparison
            ? (() => {
                  const diffs = seasonNumbers
                      .map((season, i) =>
                          season > LEGACY_SEASON_THRESHOLD &&
                          creditsValues[i] !== 0
                              ? ((oldSystemValues[i]! - creditsValues[i]!) /
                                    creditsValues[i]!) *
                                100
                              : null,
                      )
                      .filter((d): d is number => d !== null);
                  return diffs.length > 0
                      ? diffs.reduce((a, b) => a + b, 0) / diffs.length
                      : undefined;
              })()
            : undefined;

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "credits-by-season.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Credits earned from guild bosses — ${seasonNumbers.length} seasons`,
            )
            .setDescription(
                `Credits earned per season (${seasonNumbers[0]}–${seasonNumbers[seasonNumbers.length - 1]}).\n` +
                    `- Each guild boss kill awards **${CREDITS_PER_BOSS.toLocaleString()}** credits (S${LEGACY_SEASON_THRESHOLD} and earlier: **${CREDITS_PER_BOSS_LEGACY.toLocaleString()}**).\n` +
                    (showOldComparison
                        ? "- **Red line** shows the old system's total value (300 credits + orb value by today's credit price).\n"
                        : "") +
                    "- Seasons with no kills show as **0**.\n" +
                    "- Graph does not include the end-of-season leaderboard rewards, only credits earned from boss kills.\n" +
                    (trendPctPerSeason !== undefined
                        ? `- **Trend:** ${trendPctPerSeason >= 0 ? "↗️ +" : "↘️ "}${trendPctPerSeason.toFixed(1)}% per season (linear regression)\n`
                        : "") +
                    (avgOldDiffPct !== undefined
                        ? `- **Old vs new:** on average the old system was **${avgOldDiffPct >= 0 ? "+" : ""}${avgOldDiffPct.toFixed(1)}%** compared to today's credits. Note: calculation assumes mythic bosses would drop mythic orbs.\n`
                        : ""),
            )
            .setImage("attachment://credits-by-season.png")
            .setTimestamp()
            .setFooter({
                text: STANDARD_FOOTER_TEXT,
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
