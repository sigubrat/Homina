import { logger } from "@/lib";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { GuildService } from "@/lib/services/GuildService";
import { Rarity } from "@/models/enums";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Pagination } from "pagination.djs";

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
            .setMinValue(70)
    )
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
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

    const rarity = interaction.options.getString("rarity") as Rarity;

    const service = new GuildService();
    const transformer = new DataTransformationService();

    logger.info(
        `${interaction.user.username} attempting to use /gr-time-used ${season} ${rarity}`
    );

    try {
        const seasonData = await service.getGuildRaidBySeason(
            userID,
            season,
            rarity
        );

        if (!seasonData || seasonData.length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }
        const transformedData = await transformer.timeUsedPerBoss(seasonData);

        const pagination = new Pagination(interaction, {
            limit: 10,
        })
            .setColor("#0099ff")
            .setTitle("Time Used Per Boss")
            .setDescription(
                "See how long it took your guild to defeat each boss"
            )
            .setTimestamp();

        // Create a field for each boss in transformedData
        for (const [boss, data] of Object.entries(transformedData)) {
            pagination.addFields({
                name: boss,
                value: `Time: ${data.time} - Tokens: ${data.tokens}`,
            });
        }

        pagination.paginateFields(true);
        pagination.render();

        logger.info(
            `${interaction.user.username} successfully executed /gr-time-used ${season} ${rarity}`
        );
    } catch (error) {
        logger.error(
            error,
            `Error while executing /gr-time-used command for user ${userID}`
        );
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
