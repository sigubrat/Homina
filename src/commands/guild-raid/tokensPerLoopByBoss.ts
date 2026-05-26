import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { HistoryService } from "@/lib/services/HistoryService";
import { linearRegression } from "@/lib/utils/mathUtils";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("tokens-per-loop-by-boss")
    .setDescription(
        "Show how many tokens the guild spent on each boss per loop in a given season",
    )
    .addStringOption((option) =>
        option
            .setName("rarity")
            .setDescription("The rarity of the bosses to show")
            .setRequired(true)
            .addChoices(
                { name: "Legendary+", value: Rarity.LEGENDARY_PLUS },
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            ),
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
    const rarity = interaction.options.getString("rarity") as Rarity;
    const discordId = interaction.user.id;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const service = new HistoryService();

    logger.info(
        `${interaction.user.username} attempting to use /tokens-per-loop-by-boss for season ${season} rarity ${rarity}`,
    );

    try {
        const tokensPerLoopByBoss = await service.getTokensPerLoopByBoss(
            discordId,
            season,
            rarity,
        );

        if (
            !tokensPerLoopByBoss ||
            Object.keys(tokensPerLoopByBoss).length === 0
        ) {
            await interaction.editReply({
                content: `No data found for season ${season} at ${rarity} rarity. Please make sure you have registered your API-token.`,
            });
            return;
        }

        // Determine the full set of loop numbers across all bosses
        const allLoops = new Set<number>();
        for (const loopMap of Object.values(tokensPerLoopByBoss)) {
            for (const loop of Object.keys(loopMap)) {
                allLoops.add(Number(loop));
            }
        }
        const loopNumbers = [...allLoops].sort((a, b) => a - b);
        const loopLabels = loopNumbers.map((n) => `Loop ${n}`);

        // Build per-boss arrays aligned to the full loop range
        const chartData: Record<string, number[]> = {};
        for (const [boss, loopMap] of Object.entries(tokensPerLoopByBoss)) {
            chartData[boss] = loopNumbers.map((n) => loopMap[n] ?? 0);
        }

        // Compute per-boss trend descriptions for the embed
        const trendDescriptions: string[] = [];
        for (const [boss, values] of Object.entries(chartData)) {
            // Exclude the last loop (potentially in-progress) from the fit
            const fitValues = values.slice(0, -1);
            if (fitValues.length >= 2) {
                const trendline = linearRegression(fitValues, values.length);
                const first = trendline[0]!;
                const last = trendline[trendline.length - 1]!;
                if (first !== 0) {
                    const change = ((last - first) / first) * 100;
                    const arrow = last >= first ? "↗️" : "↘️";
                    const pct = `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
                    trendDescriptions.push(`${arrow} **${boss}**: ${pct}`);
                }
            }
        }

        const chartService = new ChartService();
        const chartTitle = `Tokens per boss per loop — ${rarity} — Season ${season}`;
        const chartBuffer = await chartService.createMultiLineLoopChart(
            chartData,
            loopLabels,
            chartTitle,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "tokens-per-loop-by-boss.png",
        });

        const bossCount = Object.keys(chartData).length;
        const description =
            `Tokens spent on each **${rarity}** boss per loop in season **${season}** (${loopNumbers.length} loop${loopNumbers.length !== 1 ? "s" : ""}, ${bossCount} boss${bossCount !== 1 ? "es" : ""}).\n` +
            "- Each non-bomb attack costs one token.\n" +
            "- Prime attacks are included with their boss.\n" +
            (trendDescriptions.length > 0
                ? `\n**Trends** (linear regression):\n${trendDescriptions.join("\n")}\n`
                : "");

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(chartTitle)
            .setDescription(description)
            .setImage("attachment://tokens-per-loop-by-boss.png")
            .setTimestamp()
            .setFooter({
                text: STANDARD_FOOTER_TEXT,
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /tokens-per-loop-by-boss for season ${season}`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in tokens-per-loop-by-boss: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the tokens per loop by boss chart.",
        });
        return;
    }
}
