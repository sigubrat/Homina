import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("tokens-per-loop")
    .setDescription(
        "Show how many tokens the guild spent on each loop in a given season",
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
    const discordId = interaction.user.id;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /tokens-per-loop for season ${season}`,
    );

    try {
        const tokensPerLoop = await service.getTokensPerLoopBySeason(
            discordId,
            season,
        );

        if (!tokensPerLoop || Object.keys(tokensPerLoop).length === 0) {
            await interaction.editReply({
                content: `No data found for season ${season}. Please make sure you have registered your API-token.`,
            });
            return;
        }

        const loopNumbers = Object.keys(tokensPerLoop)
            .map(Number)
            .sort((a, b) => a - b);

        const loopLabels = loopNumbers.map((n) => `Loop ${n}`);
        const tokenValues = loopNumbers.map((n) => tokensPerLoop[n] ?? 0);

        const chartService = new ChartService();
        const chartBuffer = await chartService.createSeasonalTrendChart(
            tokenValues,
            loopLabels,
            `Tokens spent per loop — Season ${season}`,
            {
                seriesLabel: "Tokens used",
                yAxisLabel: "Tokens used",
                integerTicks: true,
            },
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "tokens-per-loop.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Tokens spent per loop — Season ${season}`)
            .setDescription(
                `Total guild tokens spent on each loop in season **${season}** (${loopNumbers.length} loop${loopNumbers.length !== 1 ? "s" : ""} found).\n` +
                    "- Each non-bomb attack costs one token.\n" +
                    "- A loop corresponds to one full pass through the boss roster.\n",
            )
            .setImage("attachment://tokens-per-loop.png")
            .setTimestamp()
            .setFooter({
                text: "Referral code: HUG-44-CAN if you want to support the bot development",
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /tokens-per-loop for season ${season}`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in tokens-per-loop: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the tokens per loop chart.",
        });
        return;
    }
}
