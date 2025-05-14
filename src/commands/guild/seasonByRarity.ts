import { logger } from "@/lib";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import { sortGuildRaidResultDesc } from "@/lib/utils";
import { Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-by-tier")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
    )
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(true)
            .addChoices(
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    })
    .setDescription(
        "Show guild raid stats for a specific boss tier in a specific season"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const season = interaction.options.getNumber("season");
    const rarity = interaction.options.getString("rarity") as Rarity;

    if (!season || !Number.isInteger(season) || season <= 0) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer.",
        });
        return;
    }

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
        const result = await service.getGuildRaidResultByRaritySeasonPerBoss(
            interaction.user.id,
            season,
            rarity
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
        const chartPromises = Object.entries(result).map(
            async ([bossName, data]) => {
                const chartBuffer =
                    await chartService.createSeasonDamageChartAvg(
                        sortGuildRaidResultDesc(data),
                        `Damage dealt in season ${season} - ${
                            rarity[0] ? rarity[0].toUpperCase() : " "
                        }${(data[0] ? data[0].set : 0) + 1} ${bossName}`
                    );
                return chartBuffer;
            }
        );

        const charts = await Promise.all(chartPromises);
        const chartAttachments = charts.map((chartBuffer, index) => {
            return new AttachmentBuilder(chartBuffer, {
                name: `graph-${index}.png`,
            });
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle(`Damage dealt in season ${season}`)
            .setDescription(
                "The graph shows the damage dealt to individual guild bosses (does not include damage or tokens to primes):\n" +
                    "- **Bar chart**: Damage dealt (left y-axis)\n" +
                    "- **Line chart**: Total tokens used (right y-axis)"
            )
            .setImage("attachment://graph-0.png"); // Set the first chart as the main image

        await interaction.editReply({
            embeds: [embed],
            files: chartAttachments,
        });

        logger.info(
            `${interaction.user.username} succesfully used /season-by-tier ${season} ${rarity}`
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid results");
        await interaction.editReply({
            content: "An error occurred while fetching guild raid results.",
        });
    }
}
