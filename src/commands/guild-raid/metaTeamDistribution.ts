import { logger } from "@/lib";
import { MINIMUM_SEASON_THRESHOLD } from "@/lib/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("meta-team-distribution")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
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
    })
    .setDescription("Show the distribution of meta teams in a specific season");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    logger.info(
        `${interaction.user.username} attempting to use /meta-team-distribution`
    );

    const season = interaction.options.getNumber("season", true);
    const rarity = interaction.options.getString("rarity", false) as
        | Rarity
        | undefined;

    if (!Number.isInteger(season) || season < MINIMUM_SEASON_THRESHOLD) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer.",
        });
        return;
    }

    const service = new GuildService();

    try {
        const result = await service.getMetaTeamDistribution(
            interaction.user.id,
            season,
            rarity ? (rarity as Rarity) : undefined
        );

        if (
            !result ||
            typeof result !== "object" ||
            Object.keys(result).length === 0
        ) {
            await interaction.editReply({
                content:
                    "No data found for the specified season. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const chartService = new ChartService();

        const chart = await chartService.createMetaTeamDistributionChart(
            result,
            `How much each team was used - Season ${season}`
        );

        const dmgChart = await chartService.createMetaTeamDistributionChart(
            result,
            `How much damage each team dealt - Season ${season}`,
            true
        );

        const attachment = new AttachmentBuilder(chart, {
            name: `meta-team-distribution-${season}.png`,
        });

        const dmgAttachment = new AttachmentBuilder(dmgChart, {
            name: `meta-team-damage-distribution-${season}.png`,
        });

        const embed = new EmbedBuilder()
            .setTitle(`Meta Team Distribution for Season ${season}`)
            .setColor(0x0099ff)
            .setDescription(
                "This command shows the distribution of meta teams in the specified season.\n\n" +
                    "One chart shows the percentage of battles where each meta team was used. The other chart shows what percentage of the total damage each meta team dealt.\n" +
                    "The intent of these charts is to see how effective each team is by looking at their damage vs usage ratio.\n\n" +
                    "Battles against sidebosses are not included in the calculation."
            )
            .setFields({
                name: "Rarity filter",
                value: rarity ? `${rarity}` : "No rarity filter applied",
            })
            .setImage(`attachment://${attachment.name}`);

        await interaction.editReply({
            embeds: [embed],
            files: [attachment, dmgAttachment],
        });

        logger.info(
            `${interaction.user.username} succesfully used /meta-team-distribution for season ${season}`
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid result");
        await interaction.editReply({
            content: "An error occurred while fetching the guild raid result.",
        });
        return;
    }
}
