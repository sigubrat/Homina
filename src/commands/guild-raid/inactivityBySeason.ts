import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService.ts";
import { sortTokensUsed } from "@/lib/utils/mathUtils";
import { isInvalidSeason } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import type { TokensUsed } from "@/models/types/TokensUsed";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("inactivity-by-season")
    .setDescription(
        "Find out who did not use the required number of tokens in a season",
    )
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season to check (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD);
    })
    .addNumberOption((option) => {
        return option
            .setName("threshold")
            .setDescription(
                "The minimum number of tokens used to be considered active in your guild (Default: 1).",
            )
            .setRequired(false)
            .setMinValue(1);
    })
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
            .addChoices(
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            );
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();
    const threshold = interaction.options.getNumber("threshold") || 1;
    const rarity = interaction.options.getString("rarity") as
        | Rarity
        | undefined;

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /inactivity-by-season for season ${season}`,
    );

    try {
        const result = await service.getGuildRaidResultBySeason(
            interaction.user.id,
            season,
            rarity,
            true,
        );

        if (
            !result ||
            typeof result !== "object" ||
            Object.keys(result).length === 0
        ) {
            await interaction.editReply({
                content:
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }

        // Find out who participated but did not use the required number of tokens
        let inactiveUsers: TokensUsed[] = [];
        for (const entry of result) {
            if (entry.totalTokens < threshold) {
                inactiveUsers.push({
                    username: entry.username,
                    tokens: entry.totalTokens,
                } as TokensUsed);
            }
        }

        // Then find out who did not participate at all
        const guildId = await service.getGuildId(interaction.user.id);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not find your guild's ID. Please make sure you have registered your API-token",
            });
            return;
        }
        const players = await service.getMemberlist(guildId);
        if (!players || players.length === 0) {
            await interaction.editReply({
                content:
                    "No players found in the guild. Please make sure you have registered your API-token",
            });
            return;
        }

        const playersNotParticipated = players.filter(
            (player) =>
                !result.some((entry) => entry.username === player.username),
        );

        for (const player of playersNotParticipated) {
            inactiveUsers.push({
                username: player.username,
                tokens: 0,
            } as TokensUsed);
        }

        if (inactiveUsers.length === 0) {
            await interaction.editReply({
                content: `All users in the guild have used at least ${threshold} tokens in season ${season}.`,
            });
            return;
        }

        inactiveUsers = sortTokensUsed(inactiveUsers);

        // Create a nice embed table with the results
        const table = inactiveUsers
            .map(
                (user) =>
                    `\`${user.username}\` - ${user.tokens} token${
                        user.tokens > 1 ? "s" : ""
                    }`,
            )
            .join("\n");

        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const embed = new EmbedBuilder()
            .setTitle(`Inactive users in season ${seasonDisplay}`)
            .setColor(0x0099ff)
            .setDescription(
                "The number of players who did not use the required number of tokens:\n" +
                    `- **Threshold**: ${threshold} token(s)\n` +
                    `- **Rarity:** ${rarity ?? "All Rarities"}\n` +
                    "- **Includes primes:** Yes\n",
            )
            .setFields([
                {
                    name: "Inactive Users",
                    value: table,
                },
            ])
            .setFooter({ text: "Gleam code: LOVRAFFLE" });

        await interaction.editReply({ embeds: [embed] });

        logger.info(
            `${interaction.user.username} succesfully used /inactivity-by-season for season ${season}`,
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid result: ");
        await interaction.editReply({
            content: "An error occurred while fetching the guild raid result.",
        });
        return;
    }
}
