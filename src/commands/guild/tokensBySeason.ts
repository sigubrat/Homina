import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService.ts";
import { sortTokensUsed } from "@/lib/utils";
import { Rarity } from "@/models/enums";
import type { TokensUsed } from "@/models/types/TokensUsed";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("tokens-by-season")
    .setDescription(
        "Find out how many tokens each member has used in a specific season"
    )
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season to check")
            .setRequired(true)
            .setMinValue(70);
    })
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
            .addChoices(
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
        `${interaction.user.username} attempting to use /tokens-by-season for season ${season}`
    );

    try {
        const result = await service.getGuildRaidResultBySeason(
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
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }

        // Find out who participated but did not use the required number of tokens
        let tokensUsed: TokensUsed[] = [];
        for (const entry of result) {
            tokensUsed.push({
                username: entry.username,
                tokens: entry.totalTokens,
            } as TokensUsed);
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
            tokensUsed.push({
                username: player.username,
                tokens: 0,
            } as TokensUsed);
        }

        tokensUsed = sortTokensUsed(tokensUsed);

        // Create a nice embed table with the results
        const table = tokensUsed
            .map(
                (user) =>
                    `\`${user.username}\` - ${user.tokens} token${
                        user.tokens > 1 ? "s" : ""
                    }`
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setTitle(`Tokens used in season ${season}`)
            .setColor(0x0099ff)
            .setDescription(
                `Tokens used by each player\n` +
                    `- **Rarity:** ${rarity ?? "All Rarities"}\n` // Keep this aligned with the previous line
            )
            .setFields([
                {
                    name: "Tokens used",
                    value: table,
                },
            ]);

        await interaction.editReply({ embeds: [embed] });

        logger.info(
            `${interaction.user.username} succesfully used /tokens-by-season for season ${season}`
        );
    } catch (error) {
        logger.error("Error occured in tokens-by-season: ", error);
        await interaction.editReply({
            content:
                "An error occured while attempting to get tokens used in season: " +
                season,
        });
        return;
    }
}
