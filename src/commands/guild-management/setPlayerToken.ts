import { dbController, logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { testPlayerApiToken } from "@/lib/utils/commandUtils";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import type { MiddlewareMember } from "@/models/types";
import {
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("set-player-token")
    .setDescription(
        "Register a player-scope API token for a guild member to enable precise cooldown data",
    )
    .addStringOption((option) =>
        option
            .setName("player")
            .setDescription("The guild member to register a token for")
            .setRequired(true)
            .setAutocomplete(true),
    )
    .addStringOption((option) =>
        option
            .setName("player-token")
            .setDescription("The player-scope API token")
            .setRequired(true)
            .setMaxLength(36)
            .setMinLength(36),
    );

async function getRawMembersAndMetadata(
    discordId: string,
    touchLastUsed: boolean = true,
) {
    const service = new GuildService();
    const guildId = await service.getGuildId(discordId);
    if (!guildId) return null;

    const members = await fetchGuildMembers(guildId);
    if (!members || members.length === 0) return null;

    const metadata = await dbController.getAllPlayerMetadataByGuild(
        guildId,
        touchLastUsed,
    );
    const nicknameMap = new Map<string, string>();
    for (const entry of metadata) {
        if (entry.nickname) {
            nicknameMap.set(entry.userId, entry.nickname);
        }
    }

    return { guildId, members, nicknameMap };
}

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
        const data = await getRawMembersAndMetadata(discordId, false);
        if (!data) {
            await interaction.respond([]);
            return;
        }

        const { members, nicknameMap } = data;

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
        logger.error(error, "Error in set-player-token autocomplete");
        await interaction.respond([]);
    }
}

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;
    const selectedUserId = interaction.options.getString("player", true);

    if (!isValidUUIDv4(selectedUserId)) {
        await interaction.editReply({
            content:
                "Invalid player selection. Please select a player from the autocomplete suggestions.",
        });
        return;
    }

    const playerToken = interaction.options.getString("player-token", true);

    if (!isValidUUIDv4(playerToken)) {
        await interaction.editReply({
            content:
                "Invalid API token format. Please provide a valid UUID v4 token.",
        });
        return;
    }

    try {
        const data = await getRawMembersAndMetadata(discordId);
        if (!data) {
            await interaction.editReply({
                content:
                    "Could not determine your guild or fetch members. Make sure you are registered.",
            });
            return;
        }

        const { guildId, members, nicknameMap } = data;

        const selectedPlayer = members.find((m) => m.userId === selectedUserId);
        if (!selectedPlayer) {
            await interaction.editReply({
                content:
                    "The selected player is not a member of your guild. Please select a player from the autocomplete suggestions.",
            });
            return;
        }

        const inGameName = selectedPlayer.displayName;
        const nickname = nicknameMap.get(selectedUserId);
        const displayLabel = nickname
            ? `${inGameName} (aka ${nickname})`
            : inGameName;

        // Validate the player token before storing
        const isValid = await testPlayerApiToken(playerToken);
        if (!isValid) {
            await interaction.editReply({
                content:
                    "The provided player-scope API token is invalid or does not have the required permissions.",
            });
            return;
        }

        const success = await dbController.upsertPlayerMetadata(
            selectedUserId,
            guildId,
            { playerToken },
        );

        if (success) {
            await interaction.editReply({
                content: `Successfully registered player-scope token for **${displayLabel}**. Availability commands will now use precise cooldown data for this member.`,
            });
        } else {
            await interaction.editReply({
                content:
                    "Failed to store the player token. Please try again later.",
            });
        }
    } catch (error) {
        logger.error(error, "Error in /set-player-token command");
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
