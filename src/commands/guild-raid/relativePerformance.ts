import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService";
import { formatDelta } from "@/lib/utils/mathUtils";
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
    .setName("relative-performance")
    .setDescription(
        "See how each member performs relative to the guild average across all bosses at a rarity",
    )
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the bosses to compare against")
            .setRequired(false)
            .addChoices(
                { name: "Legendary+", value: Rarity.LEGENDARY_PLUS },
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            );
    })
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const rarity = interaction.options.getString("rarity", false);
    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();
    const discordId = interaction.user.id;

    logger.info(
        `${interaction.user.username} attempting to use /relative-performance ${season} ${rarity}`,
    );

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const service = new GuildService();
    const rarityDisplay = rarity ?? "All Rarities";
    const rarityFileSafe = rarityDisplay.replace(/\s+/g, "-");

    try {
        const result = await service.getWeightedRelativePerformance(
            discordId,
            season,
            (rarity as Rarity) ?? undefined,
        );

        if (
            !result ||
            typeof result !== "object" ||
            Object.keys(result).length === 0
        ) {
            await interaction.editReply({
                content:
                    "No data found for the specified season and rarity. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const chartService = new ChartService();
        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const chartBuffer = await chartService.createRelativePerformanceChart(
            result,
            `Relative Performance - Season ${seasonDisplay} (${rarityDisplay})`,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `relative-performance-${season}-${rarityFileSafe}.png`,
        });

        const sortedEntries = Object.entries(result).sort(
            ([, a], [, b]) => b - a,
        );

        const top3 = sortedEntries
            .slice(0, 3)
            .map(
                ([name, value], i) =>
                    `${["🥇", "🥈", "🥉"][i]} **${name}**: ${formatDelta(value)}`,
            )
            .join("\n");

        const bottom3 = sortedEntries
            .slice(-3)
            .reverse()
            .map(([name, value]) => `⚠️ **${name}**: ${formatDelta(value)}`)
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(
                `Relative Performance — Season ${seasonDisplay} (${rarityDisplay})`,
            )
            .setDescription(
                "This chart shows how each member performs relative to the guild average across all bosses at the specified rarity.\n\n" +
                    "**How it works:** For each boss, a player's average damage per token is compared to the guild's average damage per token for that boss. " +
                    "These ratios are then combined using a weighted average (weighted by the number of tokens used per boss).\n\n" +
                    "- **0%** = exactly at guild average\n" +
                    "- **+X%** = above guild average\n" +
                    "- **-X%** = below guild average\n\n" +
                    "**Note:** Sweeps (final hits where boss HP reaches 0) are excluded since they don't reflect true damage potential. Both bosses and sidebosses are included.",
            )
            .setFields(
                {
                    name: "Top Performers",
                    value: top3 || "N/A",
                    inline: true,
                },
                {
                    name: "Needs Improvement",
                    value: bottom3 || "N/A",
                    inline: true,
                },
            )
            .setImage(
                `attachment://relative-performance-${season}-${rarityFileSafe}.png`,
            )
            .setFooter({
                text: "Inspired by TheTimmyMan's TacticusAnalytics\nReferral code: HUG-44-CAN if you want to support the bot development",
            });

        await interaction.editReply({
            embeds: [embed],
            files: [attachment],
        });

        logger.info(
            `${interaction.user.username} successfully used /relative-performance ${season} ${rarity}`,
        );
    } catch (error) {
        logger.error(
            error,
            `${interaction.user.id} failed to use /relative-performance`,
        );
        await interaction.editReply(
            "There was an error while calculating relative performance.",
        );
    }
}
