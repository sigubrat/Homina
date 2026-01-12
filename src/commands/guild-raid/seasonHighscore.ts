import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { ChartService } from "@/lib/services/ChartService";
import { CsvService } from "@/lib/services/CsvService";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { GuildService } from "@/lib/services/GuildService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
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
    })
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();
    const rarity = interaction.options.getString("rarity", true) as Rarity;
    const discordId = interaction.user.id;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

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

        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.editReply({
                content: "Could not find the guild ID for your account",
            });
            return;
        }

        const csvBuffer = await csvService.createHighscores(
            highscores,
            guildId
        );

        const chartService = new ChartService();

        const chartBuffer = await chartService.createHighscoreChart(
            highscores,
            guildId,
            `Season ${season} Highscores (${rarity})`
        );

        const attachment = new AttachmentBuilder(chartBuffer, {
            name: `season-${season}-highscores-${rarity}.png`,
        });

        const csvAttachment = new AttachmentBuilder(csvBuffer, {
            name: `season-${season}-highscores-${rarity}.csv`,
        });

        const seasonDisplay =
            providedSeason === null ? `Current (${season})` : `${season}`;

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Season ${seasonDisplay} Highscores (${rarity})`)
            .setDescription(
                `Highscores for each player in season ${seasonDisplay} with rarity ${rarity}.`
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
