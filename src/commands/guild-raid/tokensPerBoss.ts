import { logger } from "@/lib";
import { handleCommandError } from "@/lib/utils/errorUtils";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

const commandName = "tokens-per-boss";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription("See tokens used per boss across loops in a given season")
    .addStringOption((option) => {
        return option
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

    const discordID = interaction.user.id;

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const rarity = interaction.options.getString("rarity", true) as Rarity;

    const service = new RaidAnalyticsService();
    const transformer = new DataTransformationService();

    logger.info(
        `${interaction.user.username} attempting to use /${commandName} ${season} ${rarity}`,
    );

    try {
        const seasonData = await service.getGuildRaidBySeason(
            discordID,
            season,
            rarity,
        );

        if (seasonData.length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }

        const { groups } = transformer.timeUsedPerBoss(seasonData);

        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const chartService = new ChartService();

        // Build clustered+stacked bar chart data:
        // X-axis clusters = bosses, bars within each cluster = loops,
        // each bar is stacked: boss tokens + each prime's tokens
        const bossLabels = groups.map((g) => g.displayName);
        const maxLoops = Math.max(...groups.map((g) => g.loops.length));

        // Collect all unique segment kinds: "Boss" + each prime displayName
        // We need consistent segment types across all groups
        type StackedSegment = {
            kind: string;
            loopIndex: number;
            data: number[];
        };
        const segments: StackedSegment[] = [];

        for (let loopIdx = 0; loopIdx < maxLoops; loopIdx++) {
            // Boss segment for this loop
            const bossData = groups.map((g) => {
                const loop = g.loops[loopIdx];
                return loop?.bossRow?.tokens ?? 0;
            });
            segments.push({ kind: "Boss", loopIndex: loopIdx, data: bossData });

            // Collect all unique primes across all groups for this loop
            const allPrimeNames = new Set<string>();
            for (const group of groups) {
                const loop = group.loops[loopIdx];
                if (loop) {
                    for (const prime of loop.primeRows) {
                        allPrimeNames.add(prime.displayName);
                    }
                }
            }

            for (const primeName of allPrimeNames) {
                const primeData = groups.map((g) => {
                    const loop = g.loops[loopIdx];
                    if (!loop) return 0;
                    const prime = loop.primeRows.find(
                        (p) => p.displayName === primeName,
                    );
                    return prime?.tokens ?? 0;
                });
                segments.push({
                    kind: primeName,
                    loopIndex: loopIdx,
                    data: primeData,
                });
            }
        }

        const chartBuffer = await chartService.createStackedClusteredBarChart(
            bossLabels,
            segments,
            maxLoops,
            `Tokens per Boss — Season ${seasonDisplay}`,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "tokens-per-boss.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Tokens per Boss — Season ${seasonDisplay}`)
            .setDescription(
                "Each cluster is a boss. Each bar in the cluster is a loop, stacked by boss + prime tokens.",
            )
            .setImage("attachment://tokens-per-boss.png")
            .setTimestamp()
            .setFooter({ text: STANDARD_FOOTER_TEXT });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully executed /${commandName} ${season} ${rarity}`,
        );
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
