import { logger } from "@/lib";
import {
    CURRENT_SEASON,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { CsvService } from "@/lib/services/CsvService";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { GuildService } from "@/lib/services/GuildService";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-highscore")
    .setDescription("Get each player's highscore per boss for a season")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
            .setMaxValue(CURRENT_SEASON)
    )
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(true)
            .addChoices(
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const season = interaction.options.getNumber("season", true);
    const rarity = interaction.options.getString("rarity", true) as Rarity;
    const discordId = interaction.user.id;

    const service = new GuildService();
    try {
        const seasonResult = await service.getGuildRaidBySeason(
            discordId,
            season,
            rarity
        );

        seasonResult?.sort((a, b) => b.damageDealt - a.damageDealt);

        if (!seasonResult || seasonResult.length === 0) {
            await interaction.editReply({
                content: `No results found for season ${season} with rarity ${rarity}.`,
            });
            return;
        }

        const filteredData = seasonResult.filter(
            (raid) =>
                raid.encounterType === EncounterType.BOSS &&
                raid.damageType === DamageType.BATTLE
        );

        const transformerService = new DataTransformationService();

        const highscores = await transformerService.seasonHighscores(
            filteredData
        );

        const csvService = new CsvService();

        const csvBuffer = await csvService.createHighscores(highscores);

        const chartService = new ChartService();

        const chartBuffer = await chartService.createHighscoreChart(
            highscores,
            `Season ${season} Highscores (${rarity})`
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `season-${season}-highscores-${rarity}.png`,
        });

        const csvAttachment = new AttachmentBuilder(csvBuffer, {
            name: `season-${season}-highscores-${rarity}.csv`,
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Season ${season} Highscores (${rarity})`)
            .setDescription(
                `Highscores for each player in season ${season} with rarity ${rarity}.`
            )
            .addFields({
                name: "Graph",
                value: "The x axis contains the players and each line repsents the highest damage each user did against a specific boss (not primes)",
            })
            .setImage(`attachment://season-${season}-highscores-${rarity}.png`);

        await interaction.editReply({
            embeds: [embed],
            files: [attachment, csvAttachment],
        });
    } catch (error) {
        logger.error(error, "Error fetching season results:");
        await interaction.editReply({
            content: "An error occurred while fetching the season results.",
        });
        return;
    }
}
