import { logger } from "@/lib";
import { BotError } from "@/models/errors/BotError";
import { ServiceError } from "@/models/errors/ServiceError";
import { UserError } from "@/models/errors/UserError";
import { type ChatInputCommandInteraction, MessageFlags } from "discord.js";

export async function handleCommandError(
    interaction: ChatInputCommandInteraction,
    error: unknown,
): Promise<void> {
    const reply = (content: string) =>
        interaction.replied || interaction.deferred
            ? interaction.editReply({ content })
            : interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (error instanceof UserError) {
        logger.warn(
            { code: error.code, context: error.context },
            error.message,
        );
        await reply(error.message);
        return;
    }

    if (error instanceof ServiceError) {
        logger.error(
            { code: error.code, context: error.context, cause: error.cause },
            error.message,
        );
        await reply("Something went wrong on our end. Please try again later.");
        return;
    }

    logger.error(error, "Unhandled error in command execution");
    await reply("An unexpected error occurred.");
}

export function getErrorCode(error: unknown): string {
    if (error instanceof BotError) return error.code;
    if (error instanceof Error) return error.message;
    return String(error);
}
