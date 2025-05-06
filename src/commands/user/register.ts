import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { testApiToken } from "../../lib/utils";
import { dbController, logger } from "@/lib";

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

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const apiToken = interaction.options.getString("api-token");
    if (!apiToken) {
        await interaction.editReply({
            content: "API token is required.",
        });
        return;
    }

    logger.info(
        `User ${interaction.user.username} attempting to register a token`
    );

    let result = await testApiToken(apiToken);

    if (result) {
        result = await dbController.registerUser(interaction.user.id, apiToken);
    }

    logger.info(
        `User ${interaction.user.username} succesfully registered a token`
    );

    const response = result
        ? "Token succesfully registered to your user"
        : "Token is invalid or does not have the required permissions";

    await interaction.editReply({
        content: response,
        options: {
            flags: MessageFlags.Ephemeral,
        },
    });
}
