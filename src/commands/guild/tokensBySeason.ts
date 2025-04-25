import { GuildService } from "@/lib/services/GuildService";
import { SlashCommandBuilder } from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("tokensusedbyseason")
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true);
    })
    .setDescription(
        "Check how many tokens each member has used in a given season"
    );

export async function execute(interaction: any) {
    await interaction.deferReply();

    const service = new GuildService();

    const result = await service.getTokensBySeason(
        interaction.user.id,
        interaction.options.getNumber("season")
    );

    if (!result || typeof result !== "object") {
        await interaction.editReply({
            content:
                "Could not fetch tokens used by season. Ensure you are registered and have the correct permissions",
        });
    } else if (Object.keys(result).length === 0) {
        await interaction.editReply({
            content: "No tokens used in this season",
        });
    } else {
        // sort entries by the number value
        const sortedEntries = Object.entries(result)
            .sort((a, b) => {
                return b[1] - a[1];
            })
            .map(([key, value]) => {
                return `> **${key}:** ${value}`;
            })
            .join("\n");

        await interaction.editReply({
            content: `Tokens used in season ${interaction.options.getNumber(
                "season"
            )}:\n${sortedEntries}`,
        });
    }
}
