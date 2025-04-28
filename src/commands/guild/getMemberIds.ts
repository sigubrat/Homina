import { GuildService } from "@/lib/services/GuildService";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("get-member-ids")
    .setDescription(
        "Get a list of members in the guild for use in registering usernames"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();

    try {
        const members = await service.getGuildMembers(interaction.user.id);

        if (!members || members.length === 0) {
            await interaction.editReply({
                content:
                    "No members found. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        // Construct the JSON object
        const memberData = members.reduce((acc, member) => {
            acc[member] = "replace-with-username";
            return acc;
        }, {} as Record<string, string>);

        // Convert JSON object to a buffer
        const jsonBuffer = Buffer.from(
            JSON.stringify(memberData, null, 2),
            "utf-8"
        );

        // Create an attachment from the buffer
        const attachment = new AttachmentBuilder(jsonBuffer, {
            name: "memberlist.json",
        });

        // Send the attachment
        await interaction.editReply({
            content: "Here is the member list JSON file:",
            files: [attachment],
        });
    } catch (error) {
        console.error("Error fetching members:", error);
        await interaction.editReply({
            content: "An error occurred while fetching the member list.",
        });
    }
}
