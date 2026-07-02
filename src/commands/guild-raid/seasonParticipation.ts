import { ChatInputCommandInteraction } from "discord.js";
import { GuildService } from "@/lib/services/GuildService.ts";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { ChartService } from "@/lib/services/ChartService";
import {
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import { numericMedian } from "@/lib/utils/mathUtils";
import { numericAverage } from "@/lib/utils/mathUtils";
import { sortGuildRaidResultDesc } from "@/lib/utils/mathUtils";
import { getTopNDamageDealers } from "@/lib/utils/mathUtils";
import { logger } from "@/lib";
import { handleCommandError } from "@/lib/utils/errorUtils";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { Rarity } from "@/models/enums";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { replaceUserIdFieldWithDisplayNames } from "@/lib/utils/userUtils";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-participation")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    )
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
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
    .addBooleanOption((option) =>
        option
            .setName("show-bombs")
            .setDescription("Show the number of bombs used by each member")
            .setRequired(false),
    )
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
    )
    .addBooleanOption((option) =>
        option
            .setName("include-unknown")
            .setDescription(
                "Include players with unknown usernames in the results",
            )
            .setRequired(false),
    )
    .setDescription(
        "Check how much each member has participated in a specific guild raid season",
    );

export interface SeasonParticipationOptions {
    season?: number;
    rarity?: string;
    showBombs?: boolean;
    averageMethod?: "mean" | "median";
    includeUnknown?: boolean;
}

export async function renderSeasonParticipationMessage(
    ownerUserId: string,
    options: SeasonParticipationOptions = {},
): Promise<{ embeds: EmbedBuilder[]; files?: AttachmentBuilder[] }> {
    const season = options.season ?? getCurrentSeason();
    const averageMethod = options.averageMethod ?? "median";
    const rarity = options.rarity as Rarity | undefined;
    const showBombs = options.showBombs ?? false;
    const includeUnknown = options.includeUnknown ?? false;

    const service = new GuildService();
    const raidAnalytics = new RaidAnalyticsService();

    const result = await raidAnalytics.getGuildRaidResultBySeason(
        ownerUserId,
        season,
        rarity,
        true,
    );

    if (result.length === 0) {
        return {
            embeds: [
                new EmbedBuilder()
                    .setColor("#ff0000")
                    .setDescription(
                        "No data found for the specified season. Ensure you are registered and have the correct permissions.",
                    ),
            ],
        };
    }

    const players = await service.fetchGuildMembers(ownerUserId);

    const transformedResult = replaceUserIdFieldWithDisplayNames(
        result,
        "username",
        players,
    );

    const sortedResult = sortGuildRaidResultDesc(transformedResult).filter(
        (val) => !val.username.includes("Unknown #") || includeUnknown,
    );

    const topDamageDealers = getTopNDamageDealers(sortedResult, 3);
    const average =
        averageMethod === "median"
            ? numericMedian(sortedResult.map((val) => val.totalDamage))
            : numericAverage(sortedResult.map((val) => val.totalDamage));

    const chartService = new ChartService();

    const chartBuffer = await chartService.createSeasonDamageChart(
        sortedResult,
        `Damage dealt in season ${season}`,
        showBombs,
        averageMethod,
        average,
    );

    const attachment = new AttachmentBuilder(chartBuffer, {
        name: "graph.png",
    });

    const providedSeason = options.season;
    const seasonDisplay =
        providedSeason == null ? `${season} (current season)` : `${season}`;

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Damage dealt in season ${seasonDisplay}`)
        .setDescription(
            "The graph shows the contribution of each member to a guild raid season:\n" +
                "- **Stacked bars**: Blue = Boss damage, Purple = Prime damage\n" +
                "- **Labels**: Each bar shows boss/prime damage, total in green on top\n" +
                "- **Line chart**: Total tokens used (right y-axis)",
        )
        .setFields(
            {
                name: "Top Damage Dealers",
                value: topDamageDealers.join("\n") || "No damage dealers found",
            },
            {
                name: "Average Damage",
                value: `The ${averageMethod} total damage dealt is **${average.toLocaleString(
                    undefined,
                    {
                        maximumFractionDigits: 2,
                    },
                )}**`,
            },
            {
                name: "Rarity filter",
                value: rarity ? `**${rarity}**` : "None",
            },
        )
        .setImage("attachment://graph.png")
        .setFooter({
            text: STANDARD_FOOTER_TEXT,
        });

    return { embeds: [embed], files: [attachment] };
}

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

    logger.info(
        `${interaction.user.username} attempting to use /season-participation`,
    );

    try {
        const payload = await renderSeasonParticipationMessage(discordId, {
            season,
            rarity: interaction.options.getString("rarity", false) ?? undefined,
            showBombs: interaction.options.getBoolean("show-bombs") ?? false,
            averageMethod:
                (interaction.options.getString("average-method") as
                    | "mean"
                    | "median"
                    | null) ?? "median",
            includeUnknown:
                interaction.options.getBoolean("include-unknown") ?? false,
        });
        await interaction.editReply(payload);

        logger.info(
            `${interaction.user.username} successfully used /season-participation`,
        );
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
