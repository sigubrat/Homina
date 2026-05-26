import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { mapUnitIdToEmoji } from "@/lib/utils/utils";
import { Rarity } from "@/models/enums";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("prime-specialists")
    .setDescription(
        "See who deals the most damage to each prime, using data from seasons with matching primes",
    )
    .addStringOption((option) =>
        option
            .setName("rarity")
            .setDescription("The rarity tier to check")
            .setRequired(true)
            .addChoices(
                { name: "Legendary+", value: Rarity.LEGENDARY_PLUS },
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            ),
    )
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season to check (defaults to current)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const rarity = interaction.options.getString("rarity", true) as Rarity;
    const providedSeason = interaction.options.getNumber("season");
    const discordId = interaction.user.id;

    logger.info(
        `${interaction.user.username} attempting to use /prime-specialists ${rarity} season=${providedSeason}`,
    );

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    try {
        const service = new RaidAnalyticsService();
        const result = await service.getPrimeSpecialists(
            discordId,
            rarity,
            providedSeason ?? undefined,
        );

        if (!result || Object.keys(result.primes).length === 0) {
            await interaction.editReply({
                content:
                    "No prime data found for the specified rarity and season. Ensure you are registered and have data available.",
            });
            return;
        }

        const season = providedSeason ?? getCurrentSeason();
        const medals = ["🥇", "🥈", "🥉"];

        const fields = Object.entries(result.primes).map(
            ([prime, players]) => ({
                name: `${mapUnitIdToEmoji(players[0]!.unitId)} ${prime}`,
                value: players
                    .map(
                        (p, i) =>
                            `${medals[i]} **${p.player}** — ${Math.round(p.avgDmg).toLocaleString()} avg (${p.tokens} tokens)`,
                    )
                    .join("\n"),
                inline: false,
            }),
        );

        const seasonList = result.seasonsUsed.join(", ");

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle(`Prime Specialists — Season ${season} (${rarity})`)
            .setDescription(
                `Top 3 players per prime by average damage per token.\n` +
                    `Data from seasons with matching primes: ${seasonList}\n` +
                    `Only players with 2+ tokens on a prime are included.`,
            )
            .addFields(fields)
            .setTimestamp()
            .setFooter({ text: STANDARD_FOOTER_TEXT });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(error, "Error executing /prime-specialists");
        await interaction.editReply({
            content:
                "An error occurred while fetching prime specialist data. Please try again later.",
        });
    }
}
