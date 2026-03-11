import { dbController, logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import { BotEventType } from "@/models/enums";
import type { MiddlewareMember } from "@/models/types";
import {
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("set-player-nickname")
    .setDescription(
        "Set a custom display nickname for a guild member across all commands",
    )
    .addStringOption((option) =>
        option
            .setName("player")
            .setDescription("The guild member to set a nickname for")
            .setRequired(true)
            .setAutocomplete(true),
    )
    .addStringOption((option) =>
        option
            .setName("nickname")
            .setDescription("The custom nickname to display")
            .setRequired(true)
            .setMaxLength(32),
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
        logger.error(error, "Error in set-player-nickname autocomplete");
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

    const nickname = interaction.options.getString("nickname", true).trim();

    if (!nickname) {
        await interaction.editReply({ content: "Nickname cannot be empty." });
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
        const existingNickname = nicknameMap.get(selectedUserId);

        const success = await dbController.upsertPlayerMetadata(
            selectedUserId,
            guildId,
            { nickname },
        );

        if (success) {
            void dbController.logEvent(
                BotEventType.COMMAND_USE,
                "set-player-nickname",
                {
                    targetUserId: selectedUserId,
                    inGameName,
                    nickname,
                    setBy: discordId,
                },
            );
            let confirmMsg = `Successfully set nickname **${nickname}** for **${inGameName}**.`;
            if (existingNickname) {
                confirmMsg = `Successfully changed nickname for **${inGameName}** from **${existingNickname}** to **${nickname}**.`;
            }
            await interaction.editReply({ content: confirmMsg });
        } else {
            await interaction.editReply({
                content: "Failed to set nickname. Please try again later.",
            });
        }
    } catch (error) {
        logger.error(error, "Error in /set-player-nickname command");
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
