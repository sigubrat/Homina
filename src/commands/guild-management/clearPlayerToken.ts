import { dbController, logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import { BotEventType } from "@/models/enums";
import {
    type AutocompleteInteraction,
    type ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("clear-player-token")
    .setDescription(
        "Remove a player-scope API token for a guild member, reverting to estimated cooldowns",
    )
    .addStringOption((option) =>
        option
            .setName("player")
            .setDescription(
                "The guild member whose player token you want to clear",
            )
            .setRequired(true)
            .setAutocomplete(true),
    );

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

        const [members, metadata] = await Promise.all([
            fetchGuildMembers(guildId),
            dbController.getAllPlayerMetadataByGuild(guildId, false),
        ]);

        const withTokens = metadata.filter((m) => m.playerToken);
        if (withTokens.length === 0) {
            await interaction.respond([]);
            return;
        }

        const filtered = withTokens
            .filter((m) => {
                const player = members?.find((p) => p.userId === m.userId);
                const inGameName = player?.displayName ?? "";
                const nickname = m.nickname ?? "";
                return (
                    inGameName.toLowerCase().includes(focused) ||
                    nickname.toLowerCase().includes(focused)
                );
            })
            .slice(0, 25);

        await interaction.respond(
            filtered.map((m) => {
                const player = members?.find((p) => p.userId === m.userId);
                const inGameName = player?.displayName ?? m.userId;
                const label = m.nickname
                    ? `${inGameName} (aka ${m.nickname})`.slice(0, 100)
                    : inGameName.slice(0, 100);
                return { name: label, value: m.userId };
            }),
        );
    } catch (error) {
        logger.error(error, "Error in clear-player-token autocomplete");
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

    try {
        const service = new GuildService();
        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not determine your guild. Make sure you are registered.",
            });
            return;
        }

        const entry = await dbController.getPlayerMetadata(
            selectedUserId,
            guildId,
        );

        if (!entry?.playerToken) {
            await interaction.editReply({
                content:
                    "That member does not have a player-scope token registered.",
            });
            return;
        }

        const members = await fetchGuildMembers(guildId);
        const selectedPlayer = members?.find(
            (m) => m.userId === selectedUserId,
        );
        const inGameName = selectedPlayer?.displayName ?? selectedUserId;
        const displayLabel = entry.nickname
            ? `${inGameName} (aka ${entry.nickname})`
            : inGameName;

        const success = await dbController.clearPlayerToken(
            selectedUserId,
            guildId,
        );

        if (success) {
            void dbController.logEvent(
                BotEventType.COMMAND_USE,
                "clear-player-token",
                {
                    targetUserId: selectedUserId,
                    clearedBy: discordId,
                },
            );
            await interaction.editReply({
                content: `Successfully cleared player-scope token for **${displayLabel}**. Availability commands will use estimated cooldowns for this member.`,
            });
        } else {
            await interaction.editReply({
                content:
                    "Failed to clear player token. Please try again later.",
            });
        }
    } catch (error) {
        logger.error(error, "Error in /clear-player-token command");
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
