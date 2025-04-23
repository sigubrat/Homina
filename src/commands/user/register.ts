import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { testApiToken } from "../../lib/utils";
import { dbController } from "@/lib";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("register")
    .addStringOption((option) =>
        option
            .setName("api-token")
            .setDescription(
                "Your API token with guild scope and Leader/Co-Leader role"
            )
            .setRequired(true)
    )
    .setDescription("Register your account to use the bot");

export async function execute(interaction: any) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const apiToken = interaction.options.getString("api-token");

    let result = await testApiToken(apiToken);

    if (result) {
        result = await dbController.registerUser(interaction.user.id, apiToken);
    }

    const response = result
        ? "Token succesfully registered to your user"
        : "Token is invalid or does not have the required permissions";

    await interaction.editReply({
        flags: MessageFlags.Ephemeral,
        content: response,
    });
}
