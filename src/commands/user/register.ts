import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { isValidUUIDv4 } from "@/lib/utils/mathUtils";
import { testApiToken } from "@/lib/utils/commandUtils";
import { handleCommandError } from "@/lib/utils/errorUtils";
import { dbController, logger } from "@/lib";
import { HominaTacticusClient } from "@/client";
import { BotEventType } from "@/models/enums";
import { InvalidInputError } from "@/models/errors/UserError";
import { ExternalApiError } from "@/models/errors/ServiceError";

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

    try {
        const apiToken = interaction.options.getString("api-token");
        if (!apiToken || !isValidUUIDv4(apiToken)) {
            throw new InvalidInputError("API token is required and must be a valid UUID.");
        }

        logger.info(
            `User ${interaction.user.username} attempting to register a token`,
        );

        const tokenValid = await testApiToken(apiToken);
        if (!tokenValid) {
            throw new InvalidInputError(
                "Token is invalid or does not have the required permissions.",
            );
        }

        const client = new HominaTacticusClient();
        const guildResponse = await client.getGuild(apiToken);
        if (!guildResponse.success || !guildResponse.guild) {
            throw new ExternalApiError(
                `Failed to fetch guild information: ${guildResponse.message ?? "Unknown error"}`,
            );
        }

        const guildId = guildResponse.guild.guildId;
        await dbController.registerUser(interaction.user.id, apiToken, guildId);

        void dbController.logEvent(BotEventType.USER_REGISTER, "register", {
            userId: interaction.user.id,
        });

        logger.info(
            `User ${interaction.user.username} successfully registered a token`,
        );

        await interaction.editReply({
            content:
                "Token successfully registered to your user. You're all set to use the bot commands!",
        });
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
