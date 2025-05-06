import { logger } from "@/lib";
import { Collection, Events, MessageFlags } from "discord.js";

export const name = Events.InteractionCreate;
export async function execute(interaction: any) {
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
            `No command matching ${interaction.commandName} was found.`
        );
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(error);
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
