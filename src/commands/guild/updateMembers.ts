import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService.ts";
import type { GuildMemberMapping } from "@/models/types/GuildMemberMapping";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("update-members")
    .setDescription("Update the guild member list by providing a JSON file")
    .addAttachmentOption((option) => {
        return option
            .setName("file")
            .setDescription("The JSON file containing the member list")
            .setRequired(true);
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const file = interaction.options.getAttachment("file");

    if (!file) {
        await interaction.editReply({
            content: "No file provided. Please upload a valid JSON file.",
        });
        return;
    }

    logger.info(
        `${interaction.user.username} attempting to update guild members`
    );

    try {
        const fileExtension = file.name.split(".").pop()?.toLowerCase();
        if (fileExtension !== "json") {
            await interaction.editReply({
                content: "Invalid file type. Please upload a JSON file.",
            });
            return;
        }

        const response = await fetch(file.url);
        const data = (await response.json()) as Record<string, string>;

        if (!data || typeof data !== "object") {
            await interaction.editReply({
                content:
                    "Invalid JSON format. Please ensure the file contains a valid JSON object.",
            });
            return;
        }

        const service = new GuildService();

        const guildId = await service.getGuildId(interaction.user.id);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not find your guild's ID. Please make sure you have registered your API-token",
            });
            return;
        }

        const members = Object.entries(data).map(([userId, username]) => {
            return { userId, username } as GuildMemberMapping;
        });

        if (members.length === 0) {
            await interaction.editReply({
                content:
                    "No members found in the provided file. Please ensure the file contains valid member data.",
            });
            return;
        }

        const result = await service.updateGuildMembers(guildId, members);
        if (result <= 0) {
            await interaction.editReply({
                content:
                    "Something went wrong while updating the guild members. Please try again. Contact the bot owner if the problem persists.",
            });
            return;
        }

        if (result < members.length) {
            await interaction.editReply({
                content:
                    `Could only update (${result}/${members.length}) guild members. Please check your JSON file and try again.\n` +
                    "Contact the bot owner if the problem persists.",
            });
            return;
        }

        logger.info(
            `Updated guild members for user ${interaction.user.username}`
        );

        await interaction.editReply({
            content: `Succesfully updated all guild members.`,
        });
    } catch (error) {
        logger.error(error, "Error processing the attachment");
        await interaction.editReply({
            content:
                "An error occurred while processing the attached file. Please ensure it is valid JSON.",
        });
        return;
    }
}
