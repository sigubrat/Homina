import { logger } from "@/lib";
import {
    CURRENT_SEASON,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService";
import { numericMedian } from "@/lib/utils/mathUtilts";
import { numericAverage } from "@/lib/utils/mathUtilts";
import { standardDeviation } from "@/lib/utils/mathUtilts";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-bombs")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
            .setMaxValue(CURRENT_SEASON)
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
        "Check how many bombs each member has used in a specific guild raid season"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const season = interaction.options.getNumber("season");
    if (!season || !Number.isInteger(season)) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer.",
        });
        return;
    }

    const service = new GuildService();

    try {
        const bombs = await service.getGuildRaidBombsBySeason(
            interaction.user.id,
            season
        );

        if (!bombs || Object.keys(bombs).length === 0) {
            await interaction.editReply({
                content: `No data found for season ${season}.`,
            });
            return;
        }

        const averageMethod = interaction.options.getString(
            "average-method"
        ) as "mean" | "median" | null;

        const average =
            averageMethod === "mean"
                ? numericAverage(Object.values(bombs))
                : numericMedian(Object.values(bombs));

        const chartService = new ChartService();

        const chartBuffer = await chartService.createNumberUsedChart(
            bombs,
            "Bombs used in season " + season,
            average,
            averageMethod === "mean" ? "Guild mean" : "Guild median",
            20
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `bombs-season-${season}.png`,
        });

        const displayAverage = averageMethod === "mean" ? "Mean" : "Median";

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Bombs used in season ${season}`)
            .setDescription(
                `The graph shows the number of bombs used by each member in season ${season}.\n` +
                    "- **Bar chart:** the number of bombs used by each member.\n" +
                    `- **Line chart:** represents the ${displayAverage.toLowerCase()} number of bombs used by the guild.`
            )
            .addFields(
                {
                    name: displayAverage,
                    value: `The ${displayAverage} number of bombs used:  ${average.toFixed(
                        1
                    )}`,
                },
                {
                    name: "Standard deviation",
                    value: `The standard deviation of bombs used: ${standardDeviation(
                        Object.values(bombs)
                    ).toFixed(1)}`,
                }
            )
            .setImage("attachment://bombs-season-" + season + ".png");

        await interaction.editReply({
            embeds: [embed],
            files: [attachment],
        });

        logger.info(
            `Guild raid bombs for season ${season} requested by user ${interaction.user.id}`
        );
    } catch (error) {
        logger.error(
            `Error fetching guild raid bombs for season ${season}: ${error}`
        );
        await interaction.editReply({
            content: `An error occurred while fetching data for season ${season}. Please try again later.`,
        });
    }
}
