import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { dbController } from "@/lib";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("delete")
    .setDescription("Delete your discord account and api-token from the bot");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const result = await dbController.deleteUser(interaction.user.id);

    const response = result
        ? "Succesfully deleted your account and api-token from the bot"
        : "Could not delete your account. Either you are not registered or an error occurred. Contact the developer if you're sure you are registered";

    await interaction.editReply({
        options: { flags: MessageFlags.Ephemeral },
        content: response,
    });
}
