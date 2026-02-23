import { logger } from "@/lib";
import { MessageService } from "@/lib/services/MessageService";
import { Collection, Events, MessageFlags } from "discord.js";

export const name = Events.InteractionCreate;
export async function execute(interaction: any) {
    // Handle button interactions
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // Check if this is an invite button
        if (
            customId.startsWith("invite_confirm_") ||
            customId.startsWith("invite_decline_")
        ) {
            const messageService = new MessageService(interaction.client);

            // Extract userId from customId and verify it matches the user clicking
            const userId = customId.split("_")[2];
            if (userId !== interaction.user.id) {
                await interaction.reply({
                    content: "This invitation is not for you.",
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (customId.startsWith("invite_confirm_")) {
                const parts = customId.split("_");
                const apiToken = parts[3];
                const inviterId = parts[4];
                if (!apiToken || !inviterId) {
                    await interaction.reply({
                        content: "Invalid invitation data.",
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                await messageService.handleInviteConfirm(
                    interaction,
                    apiToken,
                    inviterId,
                );
            } else if (customId.startsWith("invite_decline_")) {
                await messageService.handleInviteDecline(interaction);
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return; // Ignore non-chat input commands

    const command = interaction.client.commands.get(interaction.commandName);

    const { cooldowns } = interaction.client;
    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const defaultCooldownDuration = 3;
    const cooldownAmount =
        (command.cooldown ?? defaultCooldownDuration) * 1_000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime =
            timestamps.get(interaction.user.id) + cooldownAmount;

        if (now < expirationTime) {
            const expiredTimestamp = Math.round(expirationTime / 1_000);
            return interaction.reply({
                content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                flags: MessageFlags.Ephemeral,
            });
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    if (!command) {
        logger.error(
            `No command matching ${interaction.commandName} was found.`,
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(error, "Failed to create interaction command");
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: "There was an error while executing this command!",
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: "There was an error while executing this command!",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}
