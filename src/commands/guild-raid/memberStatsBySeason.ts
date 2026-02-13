import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { CsvService } from "@/lib/services/CsvService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import type { GuildRaidResult } from "@/models/types";
import type { TeamDistribution } from "@/models/types/TeamDistribution";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";
import { Pagination } from "pagination.djs";

export interface MemberStatsPerSeason extends GuildRaidResult {
    distribution: TeamDistribution;
}

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("member-stats-per-season")
    .setDescription(
        "Display detailed statistics for each member in a specific season",
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
    .addBooleanOption((option) => {
        return option
            .setName("export")
            .setDescription("Export the results as a CSV file")
            .setRequired(false);
    });

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
        `${interaction.user.username} attempting to use /member-stats-per-season for season ${season}`,
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
                    "Something went wrong while fetching guild members from the game. Please try again or contact the support server if the issue persists",
            });
            return;
        }

        // Replace User IDs with display names in the result
        for (const entry of result) {
            const player = players.find((p) => p.userId === entry.username);
            if (player) {
                entry.username = player.displayName;
            }
        }

        // Add players that did not participate in the season
        const playersNotParticipated = players.filter(
            (player) =>
                !result.some((entry) => entry.username === player.displayName),
        );

        playersNotParticipated.forEach((player) => {
            result.push({
                username: player.displayName,
                totalDamage: 0,
                totalTokens: 0,
                boss: "None",
                set: 0,
                tier: 0,
                startedOn: 0,
                bombCount: 0,
            });
        });

        // Sort by total damage descending
        result.sort((a, b) => b.totalDamage - a.totalDamage);

        const teamDistributions =
            await service.getMetaTeamDistributionPerPlayer(
                discordId,
                season,
                rarity,
            );

        if (!teamDistributions) {
            await interaction.editReply({
                content:
                    "No team distributions found for the specified season.",
            });
            return;
        }

        // replace userIds with display names in teamDistributions
        let unknownCounter = 1;
        for (const username in teamDistributions) {
            const player = players.find((p) => p.userId === username);
            if (player) {
                teamDistributions[player.displayName] =
                    teamDistributions[username]!;
            } else {
                teamDistributions[`Unknown#${unknownCounter++}`] =
                    teamDistributions[username]!;
            }
            delete teamDistributions[username];
        }

        // Merge the team distributions with the raid results
        const mergedResults: MemberStatsPerSeason[] = [];
        result.forEach((res) => {
            const distribution = teamDistributions[res.username];
            if (distribution) {
                mergedResults.push({
                    ...res,
                    distribution,
                });
            }
        });

        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const pagination = new Pagination(interaction, {
            limit: 6,
        })
            .setColor("#0099ff")
            .setTitle("Member stats for season " + seasonDisplay)
            .setDescription(
                "See the detailed statistics for each member in the specified season.\n\n" +
                    ":family: - Team distribution used by the player\n" +
                    ":bar_chart: - Percentage of total damage dealt by meta teams\n\n" +
                    "**Includes primes:** Yes",
            )
            .setFields({
                name: "Rarity filter",
                value: rarity ? `**${rarity}**.` : "None.",
            })
            .setTimestamp()
            .setFooter({
                text: "Gleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support me",
            });

        for (const stats of mergedResults) {
            const formattedDamage = stats.totalDamage.toLocaleString();
            const formattedTokens = stats.totalTokens.toLocaleString();
            const formattedMax =
                stats.maxDmg?.toLocaleString("default", {
                    maximumFractionDigits: 1,
                }) ?? "N/A";
            const formattedMin =
                stats.minDmg?.toLocaleString("default", {
                    maximumFractionDigits: 1,
                }) ?? "N/A";
            const formattedAvg = (
                stats.totalDamage /
                (stats.totalTokens > 0 ? stats.totalTokens : 1)
            ).toLocaleString("default", {
                maximumFractionDigits: 1,
            });
            const formattedTeamDistribution = `:family:  Multihit: \`${stats.distribution.multihit.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Mech: \`${stats.distribution.mech.toLocaleString("default", {
                maximumFractionDigits: 1,
            })}%\` Neuro: \`${stats.distribution.neuro.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Custodes: \`${stats.distribution.custodes.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Other: \`${stats.distribution.other.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\`
            :bar_chart: Multihit: \`${stats.distribution.multihitDamage?.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Mech: \`${stats.distribution.mechDamage?.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Neuro: \`${stats.distribution.neuroDamage?.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Custodes: \`${stats.distribution.custodesDamage?.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\` Other: \`${stats.distribution.otherDamage?.toLocaleString(
                "default",
                {
                    maximumFractionDigits: 1,
                },
            )}%\``;

            pagination.addFields({
                name: `${stats.username}`,
                value: `Total Damage: \`${formattedDamage}\` — Total Tokens: \`${formattedTokens}\` — Avg: \`${formattedAvg}\`\nMax damage: \`${formattedMax}\` — Min damage: \`${formattedMin}\`\n${formattedTeamDistribution}`,
                inline: false,
            });
        }

        pagination.paginateFields(true);

        if (interaction.options.getBoolean("export")) {
            const csvService = new CsvService();
            const csvBuffer = await csvService.createMemberStats(mergedResults);
            pagination.setAttachments([
                new AttachmentBuilder(csvBuffer, {
                    name: `member-stats-season-${season}.csv`,
                }),
            ]);
        }

        pagination.render();

        logger.info(
            `${interaction.user.username} successfully used /member-stats-per-season for season ${season}`,
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid result: ");
        await interaction.editReply({
            content: "An error occurred while fetching the guild raid result.",
        });
        return;
    }
}
