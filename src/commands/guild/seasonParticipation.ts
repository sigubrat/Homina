import { ChatInputCommandInteraction } from "discord.js";
import { GuildService } from "@/lib/services/GuildService.ts";
import { ChartService } from "@/lib/services/ChartService";
import {
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import { getTopNDamageDealers } from "@/lib/utils";

const CHART_WIDTH = 1200;
const CHART_HEIGHT = 800;

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-participation")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
    )
    .setDescription(
        "Check how much each member has participated in a specific guild raid season"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const season = interaction.options.getNumber("season") as number;

    if (!Number.isInteger(season) || season <= 0) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer.",
        });
        return;
    }

    const service = new GuildService();

    try {
        const result = await service.getGuildRaidResultBySeason(
            interaction.user.id,
            season
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

        // Add users that did not participate in the season
        const guildId = await service.getGuildId(interaction.user.id);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not find your guild's ID. Please make sure you have registered your API-token",
            });
            return;
        }
        const players = await service.getPlayerList(guildId);
        if (!players || players.length === 0) {
            await interaction.editReply({
                content:
                    "No players found in the guild. Please make sure you have registered your API-token",
            });
            return;
        }
        const playersNotParticipated = players.filter(
            (player) =>
                !result.some((entry) => entry.username === player.username)
        );

        playersNotParticipated.forEach((player) => {
            result.push({
                username: player.username,
                totalDamage: 0,
                totalTokens: 0,
                boss: "None",
                set: 0,
            });
        });

        const sortedResult = result.sort(
            (a, b) => b.totalDamage - a.totalDamage
        );

        const topDamageDealers = getTopNDamageDealers(sortedResult, 3);

        const chartService = new ChartService(CHART_WIDTH, CHART_HEIGHT);

        const chartBuffer = await chartService.createSeasonDamageChart(
            sortedResult,
            `Damage dealt in season ${season}`
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "graph.png",
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`Damage dealt in season ${season}`)
            .setDescription(
                "The graph shows the contribution of each member to a guild raid season:\n" +
                    "- **Bar chart**: Damage dealt (left y-axis)\n" +
                    "- **Line chart**: Total tokens used (right y-axis)\n" +
                    `\n**Top ${topDamageDealers.length} Damage Dealers:**
                    ${topDamageDealers.join("\n")}`
            )
            .setImage("attachment://graph.png");

        await interaction.editReply({ embeds: [embed], files: [attachment] });
    } catch (error) {
        console.error("Error executing command:", error);
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
