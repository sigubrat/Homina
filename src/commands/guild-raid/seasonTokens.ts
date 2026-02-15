import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { numericMedian } from "@/lib/utils/mathUtils";
import { numericAverage } from "@/lib/utils/mathUtils";
import { standardDeviation } from "@/lib/utils/mathUtils";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { replaceUserIdFieldWithDisplayNames } from "@/lib/utils/userUtils";
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
        "Find out how many tokens each member has used in a specific season",
    )
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season to check (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD);
    })
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
            .addChoices(
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            );
    })
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
                },
            )
            .setDescription(
                "Median is recommended if you have big variation in damage, mean otherwise",
            )
            .setRequired(false),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();
    const rarity = interaction.options.getString("rarity") as
        | Rarity
        | undefined;
    const discordId = interaction.user.id;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /tokens-by-season for season ${season}`,
    );

    try {
        const result = await service.getGuildRaidResultBySeason(
            discordId,
            season,
            rarity,
            true,
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

        const players = await service.fetchGuildMembers(discordId);
        if (!players) {
            await interaction.editReply({
                content:
                    "No players found in the guild. Please make sure you have registered your API-token",
            });
            return;
        }

        const transformedResult = replaceUserIdFieldWithDisplayNames(
            result,
            "username",
            players,
        );

        // Find out who participated
        const tokensUsed: Record<string, number> = {};
        for (const entry of transformedResult) {
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

        const playersNotParticipated = players.filter(
            (player) =>
                !transformedResult.some(
                    (entry) => entry.username === player.displayName,
                ),
        );

        for (const player of playersNotParticipated) {
            tokensUsed[player.displayName] = 0;
        }

        const chartService = new ChartService();

        const averageMethod =
            interaction.options.getString("average-method") === "mean"
                ? "Mean"
                : "Median";

        const avg =
            averageMethod === "Mean"
                ? numericAverage(Object.values(tokensUsed))
                : numericMedian(Object.values(tokensUsed));

        const chartBuffer = await chartService.createNumberUsedChart(
            tokensUsed,
            `Tokens used in season ${season}${rarity ? ` (${rarity})` : ""}`,
            avg,
            averageMethod,
            30,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `tokens-used-season-${season}.png`,
        });

        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Tokens used in season ${seasonDisplay}${
                    rarity ? ` (${rarity})` : ""
                }`,
            )
            .setDescription(
                `The graph shows the number of tokens used by each member in season ${season}.\n` +
                    "- **Bar chart:** the number of tokens used by each member.\n" +
                    `- **Line chart:** represents the ${averageMethod.toLowerCase()} number of tokens used by the guild.\n` +
                    "- **Includes primes:** Yes\n",
            )
            .addFields(
                {
                    name: averageMethod,
                    value: `The ${averageMethod} number of tokens used: ${avg.toFixed(
                        1,
                    )}`,
                },
                {
                    name: "Standard deviation",
                    value: `The standard deviation of tokens used: ${standardDeviation(
                        Object.values(tokensUsed),
                    ).toFixed(1)}`,
                },
            )
            .setImage(`attachment://tokens-used-season-${season}.png`)
            .setTimestamp()
            .setFooter({
                text: "Gleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support me",
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} succesfully used /tokens-by-season for season ${season}`,
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
