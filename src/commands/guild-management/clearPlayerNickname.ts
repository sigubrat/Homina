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
    .setName("clear-player-nickname")
    .setDescription(
        "Remove a custom nickname for a guild member, restoring their in-game name",
    )
    .addStringOption((option) =>
        option
            .setName("player")
            .setDescription("The guild member whose nickname you want to clear")
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

        const withNicknames = metadata.filter((m) => m.nickname);
        if (withNicknames.length === 0) {
            await interaction.respond([]);
            return;
        }

        const filtered = withNicknames
            .filter((m) => {
                const player = members?.find((p) => p.userId === m.userId);
                const inGameName = player?.displayName ?? "";
                return (
                    m.nickname!.toLowerCase().includes(focused) ||
                    inGameName.toLowerCase().includes(focused)
                );
            })
            .sort((a, b) => a.nickname!.localeCompare(b.nickname!))
            .slice(0, 25);

        await interaction.respond(
            filtered.map((m) => {
                const player = members?.find((p) => p.userId === m.userId);
                const inGameName = player?.displayName ?? m.userId;
                const label = `${m.nickname} (in-game: ${inGameName})`.slice(
                    0,
                    100,
                );
                return { name: label, value: m.userId };
            }),
        );
    } catch (error) {
        logger.error(error, "Error in clear-player-nickname autocomplete");
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

        if (!entry?.nickname) {
            await interaction.editReply({
                content: "That member does not have a custom nickname set.",
            });
            return;
        }

        const clearedNickname = entry.nickname;

        const success = await dbController.clearPlayerNickname(
            selectedUserId,
            guildId,
        );

        if (success) {
            void dbController.logEvent(
                BotEventType.COMMAND_USE,
                "clear-player-nickname",
                {
                    targetUserId: selectedUserId,
                    clearedNickname,
                    clearedBy: discordId,
                },
            );
            await interaction.editReply({
                content: `Successfully cleared nickname **${clearedNickname}**. The member's in-game name will be used again.`,
            });
        } else {
            await interaction.editReply({
                content: "Failed to clear nickname. Please try again later.",
            });
        }
    } catch (error) {
        logger.error(error, "Error in /clear-player-nickname command");
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
