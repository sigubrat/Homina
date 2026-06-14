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
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Pagination } from "pagination.djs";

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

        const pagination = new Pagination(interaction, {
            limit: 4,
        })
            .setColor("#0099ff")
            .setTitle(`Time per Boss — Season ${seasonDisplay}`)
            .setDescription(
                `Kill times for each boss at **${rarity}** rarity.\nTotal season time: **${totalTime}**\n\n` +
                    `**Format:** \`total time\` (\`boss only\`) (tokens/bombs)\n` +
                    `Sidebosses are listed below each boss.`,
            )
            .setTimestamp()
            .setFooter({ text: STANDARD_FOOTER_TEXT });

        // Transpose: instead of "per boss, show loops", display "per loop cycle, show bosses in kill order"
        const maxLoops = Math.max(...groups.map((g) => g.loops.length));

        for (let loopIdx = 0; loopIdx < maxLoops; loopIdx++) {
            // Collect each group's entry at this loop index, sorted by firstStartedOn
            const loopEntries = groups
                .filter((g) => g.loops[loopIdx])
                .map((g) => ({
                    group: g,
                    loop: g.loops[loopIdx]!,
                }))
                .sort(
                    (a, b) =>
                        a.loop.totalRow.firstStartedOn -
                        b.loop.totalRow.firstStartedOn,
                );

            if (loopEntries.length === 0) continue;

            const lines: string[] = [];
            let loopTotalTime = 0;

            for (const { group, loop } of loopEntries) {
                const totalTime = SecondsToString(loop.totalRow.time, true);
                const bossOnlyTime = loop.bossRow
                    ? SecondsToString(loop.bossRow.time, true)
                    : null;
                const bossTimePart =
                    bossOnlyTime && loop.primeRows.length > 0
                        ? ` (\`${bossOnlyTime}\`)`
                        : "";
                const bossLine = `${group.emoji} **${loop.rarityLabel} ${group.type}**: \`${totalTime}\`${bossTimePart} (${loop.totalRow.tokens}T / ${loop.totalRow.bombs}B)`;
                lines.push(bossLine);

                // Show sideboss breakdown if present
                for (const prime of loop.primeRows) {
                    lines.push(
                        `\u2003${prime.emoji} ${prime.displayName}: \`${SecondsToString(prime.time, true)}\``,
                    );
                }

                loopTotalTime += loop.totalRow.time;
            }

            lines.push("");
            lines.push(
                `⏱️ **Loop total: \`${SecondsToString(loopTotalTime, true)}\`**`,
            );

            const fieldName = loopIdx === 0 ? "First pass" : `Loop ${loopIdx}`;
            const fieldValue = lines.join("\n").trim();

            if (fieldValue.length <= 1024) {
                pagination.addFields({ name: fieldName, value: fieldValue });
            } else {
                const chunks: string[] = [];
                let current = "";
                for (const line of fieldValue.split("\n")) {
                    if (
                        current.length + line.length + 1 > 1024 &&
                        current.length > 0
                    ) {
                        chunks.push(current.trim());
                        current = "";
                    }
                    current += line + "\n";
                }
                if (current.trim()) chunks.push(current.trim());

                for (let i = 0; i < chunks.length; i++) {
                    const name = i === 0 ? fieldName : `${fieldName} (cont.)`;
                    pagination.addFields({ name, value: chunks[i]! });
                }
            }
        }

        pagination.paginateFields(true);
        await pagination.render();

        logger.info(
            `${interaction.user.username} successfully executed /${commandName} ${season} ${rarity}`,
        );
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
