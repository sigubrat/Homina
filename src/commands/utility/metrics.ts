import { dbController, logger } from "@/lib";
import { BotEventType } from "@/models/enums";
import { ChartService } from "@/lib/services/ChartService";
import { EmbedBuilder } from "@discordjs/builders";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 30;

export const data = new SlashCommandBuilder()
    .setName("bot-metrics")
    .setDescription("View detailed bot usage metrics and trends")
    .addStringOption((option) =>
        option
            .setName("period")
            .setDescription("Time period to display metrics for")
            .setRequired(false)
            .addChoices(
                { name: "Last 24 hours", value: "1" },
                { name: "Last 7 days", value: "7" },
                { name: "Last 30 days", value: "30" },
                { name: "All time", value: "all" },
            ),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const periodValue = interaction.options.getString("period") ?? "30";
        const isAllTime = periodValue === "all";
        const days = isAllTime ? undefined : parseInt(periodValue);
        const since = days
            ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            : undefined;

        const periodLabel = isAllTime
            ? "All Time"
            : `Last ${days} day${days === 1 ? "" : "s"}`;

        // Fetch data in parallel
        const [
            cumulative,
            commandUsage,
            dailyUses,
            dailyErrors,
            dailyRegistrations,
            dailyDeletions,
            dailyCommandUsage,
        ] = await Promise.all([
            dbController.getCumulativeMetrics(),
            dbController.getCommandUsageCounts(since, 15),
            dbController.getDailyEventCounts(
                BotEventType.COMMAND_USE,
                days ?? 9999,
            ),
            dbController.getDailyEventCounts(
                BotEventType.COMMAND_ERROR,
                days ?? 9999,
            ),
            dbController.getDailyEventCounts(
                BotEventType.USER_REGISTER,
                days ?? 9999,
            ),
            dbController.getDailyEventCounts(
                BotEventType.USER_DELETE,
                days ?? 9999,
            ),
            dbController.getDailyCommandUsage(days ?? 9999, 10),
        ]);

        // Build cumulative overview embed
        const overviewEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Bot Metrics — Cumulative Totals")
            .setDescription("All-time cumulative statistics for the bot.")
            .addFields([
                {
                    name: "Total Command Uses",
                    value: cumulative.totalCommandUses.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Total Command Errors",
                    value: cumulative.totalCommandErrors.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Error Rate",
                    value: `${(cumulative.errorRate * 100).toFixed(2)}%`,
                    inline: true,
                },
                {
                    name: "Total Registrations",
                    value: cumulative.totalRegistrations.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Total Deletions",
                    value: cumulative.totalDeletions.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Net User Growth",
                    value: (
                        cumulative.totalRegistrations -
                        cumulative.totalDeletions
                    ).toLocaleString(),
                    inline: true,
                },
            ])
            .setTimestamp();

        // Build command usage embed for the selected period
        const commandLines =
            commandUsage.length > 0
                ? commandUsage.map((cmd, i) => {
                      const errorRate =
                          cmd.uses + cmd.errors > 0
                              ? (
                                    (cmd.errors / (cmd.uses + cmd.errors)) *
                                    100
                                ).toFixed(1)
                              : "0.0";
                      return `**${i + 1}.** \`/${cmd.commandName}\` — ${cmd.uses} uses, ${cmd.errors} errors (${errorRate}%)`;
                  })
                : ["No command data available for this period."];

        const commandEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`Command Usage — ${periodLabel}`)
            .setDescription(commandLines.join("\n"));

        // Build trend summary embed
        const totalUsesInPeriod = dailyUses.reduce(
            (sum, d) => sum + d.count,
            0,
        );
        const totalErrorsInPeriod = dailyErrors.reduce(
            (sum, d) => sum + d.count,
            0,
        );
        const totalRegsInPeriod = dailyRegistrations.reduce(
            (sum, d) => sum + d.count,
            0,
        );
        const totalDelsInPeriod = dailyDeletions.reduce(
            (sum, d) => sum + d.count,
            0,
        );
        const periodErrorRate =
            totalUsesInPeriod + totalErrorsInPeriod > 0
                ? (totalErrorsInPeriod /
                      (totalUsesInPeriod + totalErrorsInPeriod)) *
                  100
                : 0;

        const avgDailyUses =
            dailyUses.length > 0
                ? Math.round(totalUsesInPeriod / dailyUses.length)
                : 0;

        const trendEmbed = new EmbedBuilder()
            .setColor(0xe67e22)
            .setTitle(`Trends — ${periodLabel}`)
            .addFields([
                {
                    name: "Commands Executed",
                    value: totalUsesInPeriod.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Command Errors",
                    value: totalErrorsInPeriod.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Period Error Rate",
                    value: `${periodErrorRate.toFixed(2)}%`,
                    inline: true,
                },
                {
                    name: "Avg Daily Commands",
                    value: avgDailyUses.toLocaleString(),
                    inline: true,
                },
                {
                    name: "New Registrations",
                    value: totalRegsInPeriod.toLocaleString(),
                    inline: true,
                },
                {
                    name: "Deletions",
                    value: totalDelsInPeriod.toLocaleString(),
                    inline: true,
                },
            ])
            .setTimestamp();

        // Generate command usage chart
        const chartService = new ChartService();
        const chartBuffer = await chartService.createCommandUsageChart(
            dailyCommandUsage,
            `Command Usage Over Time — ${periodLabel}`,
        );

        const files = [];
        if (chartBuffer) {
            files.push(
                new AttachmentBuilder(chartBuffer, {
                    name: "command-usage.png",
                }),
            );
            trendEmbed.setImage("attachment://command-usage.png");
        }

        await interaction.editReply({
            embeds: [overviewEmbed, commandEmbed, trendEmbed],
            files,
        });
    } catch (error) {
        logger.error(error, "Error fetching bot metrics");
        await interaction.editReply({
            content: "An error occurred while fetching bot metrics.",
        });
    }
}
