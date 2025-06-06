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
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    logger.info(
        `User ${interaction.user.username} attempting to register a token`
    );

    let result = await testApiToken(apiToken);
    if (!result) {
        await interaction.editReply({
            content:
                "Token is invalid or does not have the required permissions",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    result = await dbController.registerUser(interaction.user.id, apiToken);
    if (!result) {
        await interaction.editReply({
            content: "Something went wrong while registering your token",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    logger.info(
        `User ${interaction.user.username} succesfully registered a token`
    );

    await interaction.editReply({
        content:
            "Token succesfully registered to your user. Next step is to use `/get-member-ids` to start registering usernames for your guild",
        options: {
            flags: MessageFlags.Ephemeral,
        },
    });
}
