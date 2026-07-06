import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { dbController, logger } from "@/lib";
import { BotEventType } from "@/models/enums";
import { handleCommandError } from "@/lib/utils/errorUtils";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete your discord account and api-token from the bot");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    logger.info(`${interaction.user.username} attempting to use /delete`);
    try {
        // Capture the user's Tacticus guild before deletion so we can try to
        // reassign their schedules to another guild member.
        const guildId = await dbController.getGuildIdByUserId(
            interaction.user.id,
        );

        const result = await dbController.deleteUser(interaction.user.id);

        if (result) {
            void dbController.logEvent(BotEventType.USER_DELETE, "delete", {
                userId: interaction.user.id,
            });

            // Try to hand off schedules to another guild member with a token.
            // Fall back to deletion if no one else in the guild is registered.
            let handedOff = false;
            if (guildId) {
                const newOwner =
                    await dbController.findAnotherTokenHolderInGuild(
                        guildId,
                        interaction.user.id,
                    );
                if (newOwner) {
                    const reassigned =
                        await dbController.reassignSchedulesByOwner(
                            interaction.user.id,
                            newOwner,
                        );
                    if (reassigned > 0) {
                        handedOff = true;
                        logger.info(
                            `Reassigned ${reassigned} schedule(s) from ${interaction.user.id} to ${newOwner}`,
                        );
                    }
                }
            }

            if (!handedOff) {
                await dbController.deleteSchedulesByOwner(interaction.user.id);
            }
        }

        const response = result
            ? "Successfully deleted your account and api-token from the bot"
            : "Could not delete your account. Either you are not registered or an error occurred. Contact the developer if you're sure you are registered";

        await interaction.editReply({
            options: { flags: MessageFlags.Ephemeral },
            content: response,
        });
    } catch (error) {
        await handleCommandError(interaction, error);
    }

    logger.info(`${interaction.user.username} successfully used /delete`);
}
