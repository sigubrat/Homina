import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("prime-roi")
    .setDescription(
        "Compare token investment and damage between prime bosses and side bosses",
    )
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    )
    .addStringOption((option) =>
        option
            .setName("rarity")
            .setDescription("Filter by rarity tier (defaults to all)")
            .setRequired(false)
            .addChoices(
                { name: "Legendary+", value: Rarity.LEGENDARY_PLUS },
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            ),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const rarity = interaction.options.getString(
        "rarity",
        false,
    ) as Rarity | null;
    const discordId = interaction.user.id;

    logger.info(
        `${interaction.user.username} attempting to use /prime-roi season=${providedSeason} rarity=${rarity}`,
    );

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    try {
        const service = new RaidAnalyticsService();
        const result = await service.getPrimeROI(
            discordId,
            providedSeason ?? undefined,
            rarity ?? undefined,
        );

        if (!result) {
            await interaction.editReply({
                content:
                    "No data found for the specified season. Ensure you are registered and have data available.",
            });
            return;
        }

        const { summary, players } = result;
        const season = providedSeason ?? getCurrentSeason();
        const rarityDisplay = rarity ?? "All Rarities";

        const summaryText = [
            `**Prime Bosses:** ${summary.primeTokens} tokens — ${summary.primeDmgPerToken.toLocaleString()} avg dmg/token`,
            `**Side Bosses:** ${summary.sideTokens} tokens — ${summary.sideDmgPerToken.toLocaleString()} avg dmg/token`,
            `**Prime Token %:** ${summary.primePct}% of all tokens went to prime bosses`,
        ].join("\n");

        // Top 5 most prime-focused and top 5 most side-focused
        const primeFocused = players
            .filter((p) => p.primeTokens + p.sideTokens >= 5)
            .slice(0, 5)
            .map(
                (p) =>
                    `**${p.player}** — ${Math.round(p.primePct)}% prime (${p.primeTokens}P/${p.sideTokens}S)`,
            )
            .join("\n");

        const sideFocused = players
            .filter((p) => p.primeTokens + p.sideTokens >= 5)
            .slice(-5)
            .reverse()
            .map(
                (p) =>
                    `**${p.player}** — ${Math.round(p.primePct)}% prime (${p.primeTokens}P/${p.sideTokens}S)`,
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle(`Prime ROI — Season ${season} (${rarityDisplay})`)
            .setDescription(
                "Compares token investment and efficiency between prime bosses and side bosses.\n\n" +
                    summaryText,
            )
            .addFields(
                {
                    name: "🎯 Most Prime-Focused",
                    value: primeFocused || "N/A",
                    inline: true,
                },
                {
                    name: "🛡️ Most Side-Focused",
                    value: sideFocused || "N/A",
                    inline: true,
                },
            )
            .setTimestamp()
            .setFooter({ text: "Homina Bot" });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(error, "Error executing /prime-roi");
        await interaction.editReply({
            content:
                "An error occurred while fetching prime ROI data. Please try again later.",
        });
    }
}
