import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { Rarity } from "@/models/enums";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("gr-time-used")
    .setDescription(
        "See how long it takes to to complete each raid boss in a given season"
    )
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
    )
    .addStringOption((option) => {
        return option
            .setName("tier")
            .setDescription("The tier of the boss")
            .setRequired(true)
            .addChoices(
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const userID = interaction.user.id;

    const season = interaction.options.getNumber("season");
    if (!season || !Number.isInteger(season) || season <= 69) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer with the lowest available season being 69.",
        });
        return;
    }

    const rarity = interaction.options.getString("tier") as Rarity;
    if (!rarity) {
        await interaction.editReply({
            content: "Invalid rarity. Please provide a valid rarity.",
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /season-by-tier ${season} ${rarity}`
    );

    try {
        const seasonData =
            await service.getGuildRaidResultByRaritySeasonPerBoss(
                userID,
                season,
                rarity
            );

        if (
            !seasonData ||
            typeof seasonData !== "object" ||
            Object.keys(seasonData).length === 0
        ) {
            await interaction.editReply({
                content:
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }

        // For each boss, calculate the time taken to defeat it
        // The first boss time is calculated by taking the first entry and last entry for that boss
        // The remaining bosses are calculated by taking the timestamp of the last entry in the previous boss and the last entry of the current boss
    } catch (error) {}
}
