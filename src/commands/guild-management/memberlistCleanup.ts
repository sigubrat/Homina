import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("memberlist-cleanup")
    .setDescription(
        "Remove members from the memberlist who are no longer in your guild"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;

    const service = new GuildService();

    try {
        // Get the guild ID
        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not find your guild's ID. Please make sure you have registered your API-token.",
            });
            return;
        }

        // Fetch current members from the API
        const currentMembers = await service.getGuildMembers(discordId);
        if (!currentMembers || currentMembers.length === 0) {
            await interaction.editReply({
                content:
                    "Could not fetch current guild members from the API. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        // Fetch the memberlist from the database
        const memberlist = await service.getMemberlist(guildId);
        if (!memberlist || memberlist.length === 0) {
            await interaction.editReply({
                content:
                    "No members found in the memberlist. Please register usernames first using `/member-ids` and `/update-members`.",
            });
            return;
        }

        // Find members in the memberlist who are not in the current guild
        const currentMembersSet = new Set(currentMembers);
        const membersToDelete = memberlist.filter(
            (member) => !currentMembersSet.has(member.userId)
        );

        if (membersToDelete.length === 0) {
            await interaction.editReply({
                content:
                    "All members in the memberlist are still in your guild. No cleanup needed.",
            });
            return;
        }

        // Delete members who are no longer in the guild
        let deletedCount = 0;
        const failedDeletions: string[] = [];

        for (const member of membersToDelete) {
            const deleted = await service.deleteGuildMemberById(
                member.userId,
                guildId
            );
            if (deleted) {
                deletedCount++;
            } else {
                failedDeletions.push(member.username);
            }
        }

        logger.info(
            `${interaction.user.username} cleaned up members: ${deletedCount} removed, ${failedDeletions.length} failed`
        );

        // Build response message
        let responseMessage = `Successfully removed ${deletedCount} member(s) who are no longer in your guild.`;

        if (failedDeletions.length > 0) {
            responseMessage += `\n\nFailed to delete ${
                failedDeletions.length
            } member(s): ${failedDeletions.join(", ")}`;
        }

        await interaction.editReply({
            content: responseMessage,
        });
    } catch (error) {
        logger.error(error, "Error cleaning up guild members");
        await interaction.editReply({
            content:
                "An error occurred while cleaning up guild members. Please try again later.",
        });
    }
}
