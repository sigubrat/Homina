import { dbController, logger } from "@/lib";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import type { MiddlewareMember } from "@/models/types";
import {
    type AutocompleteInteraction,
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

const DEFAULT_SEASONS = 5;

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("token-history")
    .setDescription(
        "Show a player's token usage over the last N seasons as a line chart",
    )
    .addStringOption((option) =>
        option
            .setName("member")
            .setDescription("The member to view token history for")
            .setRequired(true)
            .setAutocomplete(true),
    )
    .addNumberOption((option) =>
        option
            .setName("seasons")
            .setDescription(
                `Number of past seasons to include (default: ${DEFAULT_SEASONS})`,
            )
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(15),
    );

function buildChoiceLabel(member: MiddlewareMember, nickname?: string): string {
    const base = member.displayName;
    if (nickname) {
        return `${base} (aka ${nickname})`.slice(0, 100);
    }
    return base.slice(0, 100);
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const discordId = interaction.user.id;

    try {
        const service = new GuildService();
        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.respond([]);
            return;
        }

        const members = await fetchGuildMembers(guildId);
        if (!members || members.length === 0) {
            await interaction.respond([]);
            return;
        }

        const metadata = await dbController.getAllPlayerMetadataByGuild(
            guildId,
            false,
        );
        const nicknameMap = new Map<string, string>();
        for (const entry of metadata) {
            if (entry.nickname) {
                nicknameMap.set(entry.userId, entry.nickname);
            }
        }

        const filtered = members
            .filter((m) => {
                const nick = nicknameMap.get(m.userId);
                return (
                    m.displayName.toLowerCase().includes(focused) ||
                    (nick && nick.toLowerCase().includes(focused))
                );
            })
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .slice(0, 25);

        await interaction.respond(
            filtered.map((m) => ({
                name: buildChoiceLabel(m, nicknameMap.get(m.userId)),
                value: m.userId,
            })),
        );
    } catch (error) {
        logger.error(error, "Error in token-history autocomplete");
        await interaction.respond([]);
    }
}

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const member = interaction.options.getString("member");
    if (!member || !isValidUUIDv4(member)) {
        await interaction.editReply({
            content:
                "Invalid player selection. Please select a player from the autocomplete suggestions.",
        });
        return;
    }

    const nSeasons =
        interaction.options.getNumber("seasons") ?? DEFAULT_SEASONS;
    const discordId = interaction.user.id;

    const service = new GuildService();

    // Resolve display name
    let memberDisplayName = member;
    const members = await service.fetchGuildMembers(discordId);
    if (members) {
        const matched = members.find((m) => m.userId === member);
        if (matched) {
            memberDisplayName = matched.displayName;
        }
    }

    logger.info(
        `${interaction.user.username} attempting to use /token-history for ${memberDisplayName} over last ${nSeasons} seasons`,
    );

    try {
        const tokensBySeason = await service.getTokensUsedInLastSeasons(
            discordId,
            nSeasons,
        );

        if (!tokensBySeason || Object.keys(tokensBySeason).length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified seasons. Please make sure you have registered your API-token.",
            });
            return;
        }

        // Build sorted season numbers for the x-axis
        const seasonNumbers = Object.keys(tokensBySeason)
            .map(Number)
            .sort((a, b) => a - b);

        const seasonLabels = seasonNumbers.map((s) => `S${s}`);

        // Extract this player's tokens per season (userId key in raw data)
        const tokenValues = seasonNumbers.map(
            (season) => tokensBySeason[season]![member] ?? 0,
        );

        // Calculate average over seasons where the player actually participated
        const activeValues = tokenValues.filter((v) => v > 0);
        const average =
            activeValues.length > 0
                ? activeValues.reduce((a, b) => a + b, 0) / activeValues.length
                : undefined;

        const chartService = new ChartService();
        const chartBuffer = await chartService.createTokenHistoryChart(
            tokenValues,
            seasonLabels,
            `Token usage — ${memberDisplayName}`,
            average,
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: "token-history.png",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(
                `Token history for ${memberDisplayName} — last ${seasonNumbers.length} seasons`,
            )
            .setDescription(
                `Tokens used per season (${seasonNumbers[0]}–${seasonNumbers[seasonNumbers.length - 1]}).\n` +
                    "- Seasons with no participation show as **0**.\n" +
                    (average !== undefined
                        ? `- **Average (active seasons):** ${average.toFixed(1)}\n`
                        : ""),
            )
            .setImage("attachment://token-history.png")
            .setTimestamp()
            .setFooter({
                text: "Gleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support the bot development",
            });

        await interaction.editReply({ embeds: [embed], files: [attachment] });

        logger.info(
            `${interaction.user.username} successfully used /token-history for ${memberDisplayName}`,
        );
    } catch (error) {
        logger.error(error, "Error occurred in token-history: ");
        await interaction.editReply({
            content:
                "An error occurred while generating the token history chart.",
        });
        return;
    }
}
