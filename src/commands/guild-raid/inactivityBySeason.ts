import { logger } from "@/lib";
import {
    CURRENT_SEASON,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService.ts";
import { sortTokensUsed } from "@/lib/utils/mathUtilts";
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
        "Find out who did not use the required number of tokens in a season"
    )
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season to check")
            .setRequired(true)
            .setMinValue(MINIMUM_SEASON_THRESHOLD)
            .setMaxValue(CURRENT_SEASON);
    })
    .addNumberOption((option) => {
        return option
            .setName("threshold")
            .setDescription(
                "The minimum number of tokens used to be considered active in your guild (Default: 1)."
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
                { name: "Common", value: Rarity.COMMON }
            );
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const season = interaction.options.getNumber("season") as number;
    const threshold = interaction.options.getNumber("threshold") || 1;
    const rarity = interaction.options.getString("rarity") as
        | Rarity
        | undefined;

    if (!Number.isInteger(season) || season <= 0) {
        await interaction.editReply({
            content:
                "Invalid season number. Please provide a positive integer.",
        });
        return;
    }

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /inactivity-by-season for season ${season}`
    );

    try {
        const result = await service.getGuildRaidResultBySeason(
            interaction.user.id,
            season,
            rarity,
            true
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
        const players = await service.getPlayerList(guildId);
        if (!players || players.length === 0) {
            await interaction.editReply({
                content:
                    "No players found in the guild. Please make sure you have registered your API-token",
            });
            return;
        }

        const playersNotParticipated = players.filter(
            (player) =>
                !result.some((entry) => entry.username === player.username)
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
                    }`
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle(`Inactive users in season ${season}`)
            .setColor(0x0099ff)
            .setDescription(
                "The number of players who did not use the required number of tokens:\n" +
                    `- **Threshold**: ${threshold} token(s)\n` +
                    `- **Rarity:** ${rarity ?? "All Rarities"}\n` +
                    "- **Includes primes:** Yes\n"
            )
            .setFields([
                {
                    name: "Inactive Users",
                    value: table,
                },
            ]);

        await interaction.editReply({ embeds: [embed] });

        logger.info(
            `${interaction.user.username} succesfully used /inactivity-by-season for season ${season}`
        );
    } catch (error) {
        logger.error(error, "Error fetching guild raid result: ");
        await interaction.editReply({
            content: "An error occurred while fetching the guild raid result.",
        });
        return;
    }
}
