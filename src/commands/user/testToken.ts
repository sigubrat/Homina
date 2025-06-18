import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { GuildService } from "@/lib/services/GuildService";
export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("test-token")
    .setDescription("Test your registered API token to see if it is valid");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;

    const service = new GuildService();

    const testResult = await service.testRegisteredGuildApiToken(userId);

    const embed = new EmbedBuilder()
        .setColor(testResult.status ? 0x008000 : 0xff0000)
        .setTitle("API Token Test Result")
        .setTimestamp()
        .setDescription("The result of testing your registered API token")
        .addFields(
            {
                name: "Status",
                value: testResult.status ? "✅ SUCCESS" : "❌ FAILED",
            },
            {
                name: "Message",
                value:
                    testResult.message || "No additional information provided.",
            }
        );

    await interaction.editReply({
        embeds: [embed],
    });
}
