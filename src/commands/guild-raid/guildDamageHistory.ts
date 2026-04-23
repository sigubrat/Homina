import { logger } from "@/lib";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService";
import { shortenNumber } from "@/lib/utils/utils";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

const DEFAULT_SEASONS = 5;

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("gr-damage-history")
    .setDescription(
        "Show a line chart of total guild damage dealt over the last N seasons",
    )
    .addNumberOption((option) =>
        option
            .setName("seasons")
            .setDescription(
                `Number of past seasons to include (default: ${DEFAULT_SEASONS})`,
            )
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(10),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const nSeasons =
        interaction.options.getNumber("seasons") ?? DEFAULT_SEASONS;
    const discordId = interaction.user.id;

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /gr-damage-history over last ${nSeasons} seasons`,
    );

    try {
        const damageBySeason = await service.getTotalDamageInLastSeasons(
            discordId,
            nSeasons,
        );

        if (!damageBySeason || Object.keys(damageBySeason).length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified seasons. Please make sure you have registered your API token.",
            });
            return;
        }

        const seasonNumbers = Object.keys(damageBySeason)
            .map(Number)
            .sort((a, b) => a - b);

        const seasonLabels = seasonNumbers.map((s) => `S${s}`);
        const damageValues = seasonNumbers.map((s) => damageBySeason[s]!);

        if (damageValues.every((v) => v === 0)) {
            await interaction.editReply({
                content: "No damage data found for the selected seasons.",
            });
            return;
        }

        const activeValues = damageValues.filter((v) => v > 0);
        const average =
            activeValues.length > 0
                ? activeValues.reduce((a, b) => a + b, 0) / activeValues.length
                : undefined;

        const chartService = new ChartService();
        const chartBuffer = await chartService.createGuildDamageHistoryChart(
            damageValues,
            seasonLabels,
            "Total Guild Damage Per Season",
            average,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "guild-damage-history.png",
        });

        const firstSeason = seasonNumbers[0]!;
        const lastSeason = seasonNumbers[seasonNumbers.length - 1]!;

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Guild Damage History — Last ${seasonNumbers.length} Seasons`,
            )
            .setDescription(
                `Total guild damage per season (S${firstSeason}–S${lastSeason}).\n` +
                    (average !== undefined
                        ? `- **Average:** ${shortenNumber(Math.round(average))}\n`
                        : ""),
            )
            .setImage("attachment://guild-damage-history.png")
            .setTimestamp()
            .setFooter({
                text: "Data fetched from the guild raid API.\nGleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support the bot development",
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /gr-damage-history`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in gr-damage-history: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the damage history chart. Please try again later or contact the Bot developer if the problem persists.",
        });
        return;
    }
}
