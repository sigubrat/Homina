import { dbController, logger } from "@/lib";
import { BotEventType } from "@/models/enums";
import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    ComponentType,
    MessageFlags,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("revoke-access")
    .setDescription("Revoke access for a user you previously invited");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const inviterId = interaction.user.id;

    try {
        const invitedUserIds = await dbController.getInvitedUsers(inviterId);

        if (invitedUserIds.length === 0) {
            await interaction.editReply({
                content:
                    "You have not invited any users, or all invited users have already been removed.",
            });
            return;
        }

        const options = await Promise.all(
            invitedUserIds.map(async (userId) => {
                let displayName = userId;
                try {
                    const member =
                        await interaction.guild?.members.fetch(userId);
                    displayName =
                        member?.nickname ?? member?.user.displayName ?? userId;
                } catch {
                    try {
                        const user =
                            await interaction.client.users.fetch(userId);
                        displayName = user.displayName ?? userId;
                    } catch {
                        // If we can't fetch the user, we'll just display the ID
                        logger.warn(
                            `Could not fetch user or member for ID ${userId} in /revoke-access command`,
                        );
                    }
                }
                return {
                    label: displayName,
                    description: userId,
                    value: userId,
                };
            }),
        );

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("revoke_access_select")
            .setPlaceholder("Select a user to revoke access for")
            .addOptions(options.slice(0, 25)); // Discord allows max 25 options

        const row =
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                selectMenu,
            );

        const response = await interaction.editReply({
            content: `You have invited **${invitedUserIds.length}** user(s). Select who to revoke:`,
            components: [row],
        });

        try {
            const selectInteraction = await response.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === inviterId,
                time: 60_000,
            });

            const selectedUserId = selectInteraction.values[0];
            if (!selectedUserId) {
                await selectInteraction.update({
                    content: "No user selected.",
                    components: [],
                });
                return;
            }

            const revoked = await dbController.revokeInvitedUser(
                selectedUserId,
                inviterId,
            );

            if (revoked) {
                await dbController.logEvent(
                    BotEventType.USER_DELETE,
                    "revoke",
                    {
                        userId: selectedUserId,
                        revokedBy: inviterId,
                    },
                );
                logger.info(
                    `${interaction.user.username} revoked access for user ${selectedUserId}`,
                );
                await selectInteraction.update({
                    content: `Successfully revoked access for <@${selectedUserId}>.`,
                    components: [],
                });
            } else {
                await selectInteraction.update({
                    content: `Failed to revoke access for <@${selectedUserId}>. They may have already been removed.`,
                    components: [],
                });
            }
        } catch {
            await interaction.editReply({
                content: "Selection timed out. Please try again.",
                components: [],
            });
        }
    } catch (error) {
        logger.error(error, "Error in /revoke-access command");
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
