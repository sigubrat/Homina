import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { GuildService } from "@/lib/services/GuildService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import {
    getBossEmoji,
    mapTierToRarity,
    mapUnitIdToEmoji,
    splitByCapital,
} from "@/lib/utils/utils";
import { EncounterType } from "@/models/enums";
import { Rarity } from "@/models/enums/Rarity";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("best-comps")
    .setDescription(
        "See the highest scoring raid team compositions for a season"
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
    })
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const discordID = interaction.user.id;
    const rarity = interaction.options.getString("rarity", true) as Rarity;
    const season = interaction.options.getNumber("season", true);

    if (isInvalidSeason(season)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const guildService = new GuildService();
    const dtsService = new DataTransformationService();

    try {
        const seasonData = await guildService.getGuildRaidBySeason(
            discordID,
            season,
            rarity
        );

        if (!seasonData || seasonData.length === 0) {
            await interaction.editReply(
                `No data found for season ${season} with rarity ${rarity}.`
            );
            return;
        }

        const bestCompsPerBoss = await dtsService.highestDmgComps(seasonData);
        if (Object.keys(bestCompsPerBoss).length === 0) {
            await interaction.editReply(
                `Something went wrong while processing your data. Please reach out in the support server.`
            );
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Highest scoring raid comps for season ${season}`)
            .setColor("#0099ff")
            .setDescription(
                "An overview of which characters were used to deal the highest damage against a boss"
            )
            .setFields(
                {
                    name: "Season",
                    value: `${season}`,
                    inline: true,
                },
                {
                    name: "Rarity",
                    value: rarity ? rarity : "All Rarities",

                    inline: true,
                }
            );

        for (const [boss, raid] of Object.entries(bestCompsPerBoss)) {
            embed.addFields({
                name: `${
                    raid.encounterType === EncounterType.BOSS
                        ? getBossEmoji(boss)
                        : mapUnitIdToEmoji(
                              boss.at(0)?.toLowerCase() + boss.slice(1)
                          )
                } ${mapTierToRarity(
                    raid.tier,
                    raid.set + 1,
                    false
                )} ${splitByCapital(boss).at(-1)}`,
                value: `${raid.heroDetails
                    .map((h) => mapUnitIdToEmoji(h.unitId))
                    .join()} — **Damage:** ${raid.damageDealt.toLocaleString()}`,
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(error, `Error during /best-comp by user ${discordID}`);
    }
}
