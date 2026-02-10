import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import { testApiToken } from "@/lib/utils/commandUtils";
import { dbController, logger } from "@/lib";
import { HominaTacticusClient } from "@/client";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("register")
    .addStringOption((option) =>
        option
            .setName("api-token")
            .setDescription(
                "Your API token with guild scope and Leader/Co-Leader role",
            )
            .setRequired(true)
            .setMaxLength(36)
            .setMinLength(36),
    )
    .setDescription("Register your account to use the bot");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const apiToken = interaction.options.getString("api-token");
    if (!apiToken || !isValidUUIDv4(apiToken)) {
        await interaction.editReply({
            content: "API token is required.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    logger.info(
        `User ${interaction.user.username} attempting to register a token`,
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

    // Fetch the guild ID from the API
    const client = new HominaTacticusClient();
    let guildId: string | null = null;
    try {
        const guildResponse = await client.getGuild(apiToken);
        if (guildResponse.success && guildResponse.guild) {
            guildId = guildResponse.guild.guildId;
        }
    } catch (error) {
        logger.warn(
            error,
            "Failed to fetch guild ID during registration, continuing without it",
        );
    }

    result = await dbController.registerUser(
        interaction.user.id,
        apiToken,
        guildId,
    );
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
        `User ${interaction.user.username} succesfully registered a token`,
    );

    await interaction.editReply({
        content:
            "Token successfully registered to your user. You're all set to use the bot commands!",
        options: {
            flags: MessageFlags.Ephemeral,
        },
    });
}
