import { logger } from "@/lib";
import { STANDARD_FOOTER_TEXT } from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("activity-per-hour")
    .setDescription(
        "See what time of day your guild uses their guild raid tokens",
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});

    const discordId = interaction.user.id;

    const guildService = new RaidAnalyticsService();

    try {
        const tokensUsedPerHour = await guildService.getTokenByHours(discordId);
        if (
            tokensUsedPerHour === null ||
            Object.values(tokensUsedPerHour).length === 0
        ) {
            await interaction.editReply({
                content:
                    "Could not fetch data for you. Ensure your token is valid.",
            });
            return;
        }
        const total = Object.values(tokensUsedPerHour).reduce(
            (acc, value) => acc + value,
            0,
        );

        // convert each total number to a percentage of the total
        const percentages = Object.fromEntries(
            Object.entries(tokensUsedPerHour).map(([hour, count]) => [
                hour,
                (count / total) * 100,
            ]),
        );

        const chartService = new ChartService();

        const chartBuffer = await chartService.createTimelineChart(
            percentages,
            "Guild activity per UTC hour",
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `activity-timeline.png`,
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Guild activity timeline")
            .setDescription(
                "This chart shows the distribution of what hour of the day your guild used their guild raid tokens and bombs in the current and previous season. The highlighted area is the current time. All time is in UTC.",
            )
            .setImage("attachment://activity-timeline.png")
            .setTimestamp()
            .setFooter({
                text: STANDARD_FOOTER_TEXT,
            });

        await interaction.editReply({
            embeds: [embed],
            files: [attachment],
        });

        return;
    } catch (error) {
        logger.error(error, "Error fetching token timeline:");
        await interaction.editReply({
            content: "An error occurred while fetching the token timeline.",
        });
        return;
    }
}
