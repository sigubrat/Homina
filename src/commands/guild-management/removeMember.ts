import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("remove-member")
    .setDescription(
        "Remove a member from the guild by providing their username or user ID"
    )
    .addStringOption((option) =>
        option
            .setName("user-id")
            .setDescription("The user ID of the member to remove")
            .setRequired(false)
    )
    .addStringOption((option) =>
        option
            .setName("username")
            .setDescription("The username of the member to remove")
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const idToDelete = interaction.options.getString("user-id");
    const usernameToDelete = interaction.options.getString("username");

    if (!idToDelete && !usernameToDelete) {
        await interaction.editReply({
            content:
                "Please provide either a valid user ID or username to delete",
        });
        return;
    }

    const discordId = interaction.user.id;

    try {
        const service = new GuildService();

        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.editReply({
                content: "Could not find the guild you're a member of.",
            });
            return;
        }
        let res: boolean = false;
        if (idToDelete) {
            res = await service.deleteGuildMemberById(idToDelete, guildId);
        } else {
            res = await service.deleteGuildMemberByUsername(
                usernameToDelete!,
                guildId
            );
        }

        if (res) {
            const identifier = idToDelete || usernameToDelete;
            await interaction.editReply({
                content: `Member ${identifier} has been removed from the guild.`,
            });
        } else {
            await interaction.editReply({
                content: `Could not find a member with ID ${idToDelete} or ${usernameToDelete} in the guild.`,
            });
        }
    } catch (error) {
        logger.error(error);
        await interaction.editReply({
            content: "An error occurred while trying to remove the member.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
    }
}
