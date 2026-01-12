import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { numericMedian } from "@/lib/utils/mathUtils";
import { numericAverage } from "@/lib/utils/mathUtils";
import { sortGuildRaidResultDesc } from "@/lib/utils/mathUtils";
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
    .setName("season-by-rarity")
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(true)
            .addChoices(
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    })
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
    )
    .addStringOption((option) =>
        option
            .setName("average-method")
            .setChoices(
                {
                    name: "Mean",
                    value: "mean",
                },
                {
                    name: "Median",
                    value: "median",
                }
            )
            .setDescription(
                "Median is recommended if you have big variation in damage, mean otherwise"
            )
            .setRequired(false)
    )
    .setDescription(
        "Show guild raid stats for a specific boss rarity in a specific season"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();
    const rarity = interaction.options.getString("rarity") as Rarity;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    if (!rarity) {
        await interaction.editReply({
            content: "Invalid rarity. Please provide a valid rarity.",
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /season-by-rarity ${season} ${rarity}`
    );

    try {
        const result = await service.getGuildRaidResultByRaritySeasonPerBoss(
            interaction.user.id,
            season,
            rarity
        );

        if (
            !result ||
            typeof result !== "object" ||
            Object.keys(result).length === 0
        ) {
            await interaction.editReply({
                content:
                    "No data found for the specified season. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const averageMethod =
            interaction.options.getString("average-method") === "mean"
                ? "Mean"
                : "Median";

        const chartService = new ChartService();
        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;
        const chartPromises = Object.entries(result).map(
            async ([bossName, data]) => {
                const guildDamage = data.map((val) => val.totalDamage);
                const avgDamage =
                    averageMethod === "Mean"
                        ? numericAverage(Object.values(guildDamage))
                        : numericMedian(Object.values(guildDamage));

                const chartBuffer =
                    await chartService.createSeasonDamageChartAvg(
                        sortGuildRaidResultDesc(data),
                        `Damage dealt in season ${seasonDisplay} - ${
                            rarity[0] ? rarity[0].toUpperCase() : " "
                        }${data[0] ? data[0].set : 0} ${bossName}`,
                        averageMethod,
                        avgDamage
                    );
                return chartBuffer;
            }
        );

        const charts = await Promise.all(chartPromises);
        const chartAttachments = charts.map((chartBuffer, index) => {
            return new AttachmentBuilder(chartBuffer, {
                name: `graph-${index}.png`,
            });
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`Damage dealt in season ${season}`)
            .setDescription(
                "The graph shows the damage dealt to individual guild bosses\n" +
                    "- Blue bars (left y-axis): Total damage dealt to boss\n" +
                    "- Red line (leftmost y-axis): Avg damage per token\n" +
                    "- Orange line (right y-axis): Total tokens used\n" +
                    "- Purple bars (left y-axis): Damage dealt to primes\n" +
                    "- Yellow dotted line (left y-axis): Guild average damage"
            )
            .setImage("attachment://graph-0.png"); // Set the first chart as the main image

        await interaction.editReply({
            embeds: [embed],
            files: chartAttachments,
        });

        logger.info(
            `${interaction.user.username} succesfully used /season-by-rarity ${season} ${rarity}`
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid results");
        await interaction.editReply({
            content: "An error occurred while fetching guild raid results.",
        });
    }
}
