import { logger } from "@/lib";
import { handleCommandError } from "@/lib/utils/errorUtils";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { isInvalidSeason, SecondsToString } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

const commandName = "time-per-boss";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription(
        "See how long it takes to kill each boss across loops in a given season",
    )
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

        const { groups, totalTime } = transformer.timeUsedPerBoss(seasonData);

        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Time per Boss — Season ${seasonDisplay}`)
            .setDescription(
                `Kill times for each boss at **${rarity}** rarity.\nTotal season time: **${totalTime}**`,
            )
            .setTimestamp()
            .setFooter({ text: STANDARD_FOOTER_TEXT });

        for (const group of groups) {
            const lines: string[] = [];

            for (const loop of group.loops) {
                const loopHeader =
                    group.loops.length > 1
                        ? `**Loop ${loop.loopIndex}** (${loop.rarityLabel})`
                        : `**${loop.rarityLabel}**`;
                lines.push(loopHeader);

                if (loop.bossRow) {
                    lines.push(
                        `${loop.bossRow.emoji} Boss: \`${SecondsToString(loop.bossRow.time, true)}\` (${loop.bossRow.tokens}T / ${loop.bossRow.bombs}B)`,
                    );
                }

                for (const prime of loop.primeRows) {
                    lines.push(
                        `${prime.emoji} ${prime.displayName}: \`${SecondsToString(prime.time, true)}\` (${prime.tokens}T / ${prime.bombs}B)`,
                    );
                }

                lines.push(
                    `⏱️ Loop total: \`${SecondsToString(loop.totalRow.time, true)}\``,
                );
                lines.push("");
            }

            embed.addFields({
                name: `${group.emoji} ${group.displayName}`,
                value: lines.join("\n").trim() || "No data",
            });
        }

        await interaction.editReply({ embeds: [embed] });

        logger.info(
            `${interaction.user.username} successfully executed /${commandName} ${season} ${rarity}`,
        );
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
