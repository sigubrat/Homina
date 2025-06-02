import { logger } from "@/lib";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { numericAverage, numericMedian, standardDeviation } from "@/lib/utils";
import { Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-tokens")
    .setDescription(
        "Find out how many tokens each member has used in a specific season"
    )
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season to check")
            .setRequired(true)
            .setMinValue(70);
    })
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
            .addChoices(
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    })
    .addStringOption((option) =>
        option
            .setName("average-method")
            .setChoices(
                {
                    name: "Average",
                    value: "average",
                },
                {
                    name: "Median",
                    value: "median",
                }
            )
            .setDescription(
                "Median is recommended if you have big variation in damage, average otherwise"
            )
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const season = interaction.options.getNumber("season") as number;
    const rarity = interaction.options.getString("rarity") as
        | Rarity
        | undefined;

    if (!Number.isInteger(season) || season <= 0) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer.",
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /tokens-by-season for season ${season}`
    );

    try {
        const result = await service.getGuildRaidResultBySeason(
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
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }

        // Find out who participated but did not use the required number of tokens
        const tokensUsed: Record<string, number> = {};
        for (const entry of result) {
            tokensUsed[entry.username] = entry.totalTokens || 0;
        }

        // Then find out who did not participate at all
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

        for (const player of playersNotParticipated) {
            tokensUsed[player.username] = 0;
        }

        const chartService = new ChartService();

        const averageMethod =
            interaction.options.getString("average-method") === "average"
                ? "Average"
                : "Median";

        const avg =
            averageMethod === "Average"
                ? numericAverage(Object.values(tokensUsed))
                : numericMedian(Object.values(tokensUsed));

        const chartBuffer = await chartService.createNumberUsedChart(
            tokensUsed,
            `Tokens used in season ${season}${rarity ? ` (${rarity})` : ""}`,
            avg,
            averageMethod,
            30
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `tokens-used-season-${season}.png`,
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Tokens used in season ${season}${rarity ? ` (${rarity})` : ""}`
            )
            .setDescription(
                `The graph shows the number of tokens used by each member in season ${season}.\n` +
                    "- **Bar chart:** the number of tokens used by each member.\n" +
                    `- **Line chart:** represents the ${averageMethod.toLowerCase()} number of tokens used by the guild.`
            )
            .addFields(
                {
                    name: averageMethod,
                    value: `The ${averageMethod} number of bombs used: ${avg.toFixed(
                        1
                    )}`,
                },
                {
                    name: "Standard deviation",
                    value: `The standard deviation of bombs used: ${standardDeviation(
                        Object.values(tokensUsed)
                    ).toFixed(1)}`,
                }
            )
            .setImage(`attachment://tokens-used-season-${season}.png`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} succesfully used /tokens-by-season for season ${season}`
        );
    } catch (error) {
        logger.error(error, "Error occured in tokens-by-season: ");
        await interaction.editReply({
            content:
                "An error occured while attempting to get tokens used in season: " +
                season,
        });
        return;
    }
}
