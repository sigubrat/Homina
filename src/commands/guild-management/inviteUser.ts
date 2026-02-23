import { dbController, logger } from "@/lib";
import { MessageService } from "@/lib/services/MessageService";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

// 5 minutes cooldown
export const cooldown = 5 * 60;

export const data = new SlashCommandBuilder()
    .setName("invite-user")
    .setDescription("Invite a user to register with your API token")
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription("The user to invite")
            .setRequired(true),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const commandCallerId = interaction.user.id;
    const invitedUser = interaction.options.getUser("user", true);
    const commandCallerUsername = interaction.user.username;

    if (invitedUser.id === commandCallerId) {
        await interaction.editReply({
            content: "You cannot invite yourself.",
        });
        return;
    }

    try {
        const apiToken = await dbController.getUserToken(commandCallerId);
        if (!apiToken || !isValidUUIDv4(apiToken)) {
            await interaction.editReply({
                content:
                    "Could not find a valid token registered to your discord account. Please register first using /register or reach out to the support server if something is wrong.",
            });
            return;
        }

        const messageService = new MessageService(interaction.client);
        const invitedSuccessfully = await messageService.inviteUser(
            invitedUser,
            commandCallerUsername,
            apiToken,
            commandCallerId,
        );

        if (invitedSuccessfully) {
            await interaction.editReply({
                content: `Successfully sent an invitation to <@${invitedUser.id}>. They need to confirm the invitation via DM to complete the registration.`,
            });
        } else {
            await interaction.editReply({
                content: `Failed to send an invitation to <@${invitedUser.id}>. They might have DMs disabled. Please ask them to enable DMs and try again.`,
            });
        }
    } catch (error) {
        await interaction.editReply({
            content:
                "An error occurred while trying to invite the user. Please try again later.",
        });
        logger.error(
            `Error while ${interaction.user.username} was trying to invite ${invitedUser.username}: ${error}`,
        );
    }
}
