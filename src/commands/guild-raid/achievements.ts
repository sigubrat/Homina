import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
    STANDARD_FOOTER_TEXT,
} from "@/lib/configs/constants";
import { AchievementService } from "@/lib/services/AchievementService";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;
const commandName = "season-achievements";

export const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription("See fun guild-wide superlatives and awards for a season")
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const discordId = interaction.user.id;

    logger.info(
        `${interaction.user.username} attempting to use /${commandName} season=${providedSeason}`,
    );

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    try {
        const service = new AchievementService();
        const achievements = await service.getGuildAchievements(
            discordId,
            providedSeason ?? undefined,
        );

        if (!achievements || achievements.length === 0) {
            await interaction.editReply({
                content:
                    "No achievements found for the specified season. Ensure you are registered and have data available.",
            });
            return;
        }

        const season = providedSeason ?? getCurrentSeason();

        const achievementLines = achievements.map(
            (a) =>
                `${a.emoji} **${a.name}** — ${a.player}\n╰ *${a.description}*: ${a.value}`,
        );

        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`Guild Awards — Season ${season}`)
            .setDescription(achievementLines.join("\n\n"))
            .setTimestamp()
            .setFooter({ text: STANDARD_FOOTER_TEXT });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(error, `Error executing /${commandName}`);
        await interaction.editReply({
            content:
                "An error occurred while fetching achievements. Please try again later.",
        });
    }
}
