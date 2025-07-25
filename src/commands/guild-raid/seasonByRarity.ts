import { logger } from "@/lib";
import { MINIMUM_SEASON_THRESHOLD } from "@/lib/constants";
import { ChartService } from "@/lib/services/ChartService";
import { GuildService } from "@/lib/services/GuildService.ts";
import {
    numericAverage,
    numericMedian,
    sortGuildRaidResultDesc,
} from "@/lib/utils";
import { Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-by-rarity")
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
            .setRequired(true)
            .addChoices(
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    })
    .addStringOption((option) =>
        option
            .setName("average-method")
            .setChoices(
                {
                    name: "Mean",
                    value: "mean",
                },
                {
                    name: "Median",
                    value: "median",
                }
            )
            .setDescription(
                "Median is recommended if you have big variation in damage, mean otherwise"
            )
            .setRequired(false)
    )
    .setDescription(
        "Show guild raid stats for a specific boss rarity in a specific season"
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
        `${interaction.user.username} attempting to use /season-by-rarity ${season} ${rarity}`
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

        const averageMethod =
            interaction.options.getString("average-method") === "mean"
                ? "Mean"
                : "Median";

        const chartService = new ChartService();
        const chartPromises = Object.entries(result).map(
            async ([bossName, data]) => {
                const guildDamage = data.map((val) => val.totalDamage);
                const avgDamage =
                    averageMethod === "Mean"
                        ? numericAverage(Object.values(guildDamage))
                        : numericMedian(Object.values(guildDamage));

                const chartBuffer =
                    await chartService.createSeasonDamageChartAvg(
                        sortGuildRaidResultDesc(data),
                        `Damage dealt in season ${season} - ${
                            rarity[0] ? rarity[0].toUpperCase() : " "
                        }${data[0] ? data[0].set : 0} ${bossName}`,
                        averageMethod,
                        avgDamage
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
                "The graph shows the damage dealt to individual guild bosses\n" +
                    "- **Bar chart**: Damage dealt (left y-axis)\n" +
                    "- **Line chart**: Total tokens used (right y-axis)"
            )
            .setImage("attachment://graph-0.png"); // Set the first chart as the main image

        await interaction.editReply({
            embeds: [embed],
            files: chartAttachments,
        });

        logger.info(
            `${interaction.user.username} succesfully used /season-by-rarity ${season} ${rarity}`
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid results");
        await interaction.editReply({
            content: "An error occurred while fetching guild raid results.",
        });
    }
}
