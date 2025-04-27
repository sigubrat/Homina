import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService";
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
    )
    .addStringOption((option) => {
        return option
            .setName("tier")
            .setDescription("The tier of the boss")
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

    const season = interaction.options.getNumber("season") as number;
    const rarity = interaction.options.getString("tier");

    if (!Number.isInteger(season) || season <= 0) {
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

        const chartService = new ChartService(1200, 800);

        const chart = await chartService.createMetaTeamDistributionChart(
            result,
            `Meta Team Distribution for Season ${season}`
        );

        const dmgChart = await chartService.createMetaTeamDistributionChart(
            result,
            `Meta Team Damage Distribution for Season ${season}`,
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
                "This chart shows the distribution of meta teams in the specified season."
            )
            .setImage(`attachment://${attachment.name}`);

        await interaction.editReply({
            embeds: [embed],
            files: [attachment, dmgAttachment],
        });
    } catch (error) {
        console.error("Error fetching guild raid result:", error);
        await interaction.editReply({
            content: "An error occurred while fetching the guild raid result.",
        });
        return;
    }
}
