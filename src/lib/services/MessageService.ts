import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    Client,
    EmbedBuilder,
    MessageFlags,
    User,
} from "discord.js";
import { dbController, logger } from "@/lib";
import { isValidUUIDv4 } from "../utils/mathUtils";
import path from "path";

export class MessageService {
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    public async alertDeletedUser(userId: string): Promise<void> {
        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                logger.warn(`Could not find user with ID: ${userId}`);
                return;
            }

            await user.send({
                content:
                    "Hi! To preserve your right to privacy we have deleted your registration with Homina due to inactivity (30 days without use).\n\n" +
                    "If you would like to continue using the bot, please re-register using the `/register` command.\n\n" +
                    "If you have any questions or need assistance, please contact us at the Homina support server which you can find by clicking on the bot.\n\n" +
                    "Thank you for using Homina and have a wonderful day!\n\n" +
                    "*Note: This is an automated message that cannot be replied to.*",
            });

            logger.info(`Successfully sent deletion alert to user: ${userId}`);
        } catch (error) {
            logger.error(
                error,
                `Failed to send deletion alert to user: ${userId}`
            );
        }
    }

    public async inviteUser(
        user: User,
        inviterName: string,
        apiToken: string
    ): Promise<boolean> {
        const userId = user.id;
        try {
            // Create an embed with a confirm and decline button
            const imagePath = path.join(
                __dirname,
                "../../../docs/img/homina-logo.png"
            );
            const attachment = new AttachmentBuilder(imagePath, {
                name: "homina-logo.png",
            });

            const embed = new EmbedBuilder()
                .setTitle("Invitation to Register with Homina Bot")
                .setThumbnail("attachment://homina-logo.png")
                .setDescription(
                    `${inviterName} has invited you to register with the Homina Discord bot using their API token.\n` +
                        `Registering allows you to access various features and functionalities provided by the bot.\n\n` +
                        `Press confirm to register with their token or decline the invitation.\n\n` +
                        `Note: if you do not recognise this invitation, you can safely ignore this message.`
                )
                .setColor("#0099ff")
                .setTimestamp();

            const confirmButton = new ButtonBuilder()
                .setCustomId(`invite_confirm_${userId}_${apiToken}`)
                .setLabel("Confirm")
                .setStyle(ButtonStyle.Success);

            const declineButton = new ButtonBuilder()
                .setCustomId(`invite_decline_${userId}`)
                .setLabel("Decline")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                confirmButton,
                declineButton
            );

            await user.send({
                embeds: [embed],
                components: [row],
                files: [attachment],
            });
            logger.info(`Successfully sent invitation to user: ${userId}`);
            return true;
        } catch (error) {
            logger.error(error, `Failed to send invitation to user: ${userId}`);
            return false;
        }
    }

    public async handleInviteConfirm(
        interaction: ButtonInteraction,
        apiToken: string
    ): Promise<void> {
        await interaction.deferUpdate();

        try {
            const clickedConfirmButton = new ButtonBuilder()
                .setCustomId("disabled_confirm")
                .setLabel("Confirmed")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);

            const disabledDeclineButton = new ButtonBuilder()
                .setCustomId("disabled_decline")
                .setLabel("Decline")
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true);

            await interaction.message.edit({
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        clickedConfirmButton,
                        disabledDeclineButton
                    ),
                ],
            });

            await interaction.followUp({
                content:
                    "You have confirmed the invitation. Registration processing...",
            });
            logger.info(`User ${interaction.user.id} confirmed invitation`);

            // Register the user with the provided API token
            if (!apiToken || !isValidUUIDv4(apiToken)) {
                await interaction.followUp({
                    content:
                        "Invalid API token provided. Could not register you. Please reach out to the one who invited you or the support server.",
                });
                return;
            }

            const result = await dbController.registerUser(
                interaction.user.id,
                apiToken
            );
            if (!result) {
                await interaction.followUp({
                    content:
                        "Something went wrong while registering you. Please try again later or reach out to the support server.",
                });
                return;
            }

            await interaction.followUp({
                content:
                    "You have been successfully registered! You can now use the bot's features.",
            });

            return;
        } catch (error) {
            logger.error(
                `Error registering user ${interaction.user.id}: ${error}`
            );
            await interaction.followUp({
                content:
                    "An error occurred while registering you. Please try again later or reach out to the support server.",
                options: { flags: MessageFlags.Ephemeral },
            });
        }
    }

    public async handleInviteDecline(
        interaction: ButtonInteraction
    ): Promise<void> {
        await interaction.deferUpdate();

        try {
            await interaction.message.edit({
                components: [],
            });

            await interaction.followUp({
                content: "You have declined the invitation.",
                embeds: [],
                components: [],
            });
            logger.info(`User ${interaction.user.id} declined invitation`);
        } catch (error) {
            logger.error(
                `Error handling decline for user ${interaction.user.id}: ${error}`
            );
            await interaction.followUp({
                content:
                    "An error occurred while processing your decline. Please try again later.",
                options: { flags: MessageFlags.Ephemeral },
            });
        }
    }
}
