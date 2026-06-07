import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService.ts";
import { handleCommandError } from "@/lib/utils/errorUtils";
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;
const commandName = "member-ids";

export const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription(
        "Get a list of members in the guild for use in registering usernames",
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    logger.info(
        `${interaction.user.username} attempting to use /${commandName} and received the member list`,
    );

    const service = new GuildService();

    try {
        const members = await service.getGuildMembers(interaction.user.id);

        if (members.length === 0) {
            await interaction.editReply({
                content:
                    "No members found. Ensure you are registered and have the correct permissions.",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
            return;
        }

        const players = await service.fetchGuildMembers(interaction.user.id);

        const mapping: Record<string, string> = {};
        members.forEach((member) => {
            const player = players.find((p) => p.userId === member);
            const displayName = player ? player.displayName : "Unknown";
            mapping[displayName] = member;
        });

        const memberString = Object.entries(mapping)
            .map(([displayName, userId]) => `   ${displayName}: "${userId}",`)
            .join("\n");

        // Send the attachment
        await interaction.editReply({
            content:
                "Here is a list of your guild members with their corresponding user IDs." +
                `\`\`\`js\n{\n${memberString || "No members found."}\n}\`\`\``,
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });

        logger.info(
            `${interaction.user.username} used /member-ids and received the member list`,
        );
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
