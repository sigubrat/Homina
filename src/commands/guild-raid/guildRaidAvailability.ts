import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("gr-availability")
    .setDescription(
        "Get an overview of how many guild raid tokens and bombs each member has available"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /available-tokens-bombs`
    );

    try {
        const result = await service.getAvailableTokensAndBombs(
            interaction.user.id
        );

        if (
            !result ||
            typeof result !== "object" ||
            Object.keys(result).length === 0 ||
            result === null
        ) {
            await interaction.editReply({
                content:
                    "No data found for the current season. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        // Add players who have not used any tokens or bombs yet
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
            (player) => !result[player.username]
        );

        playersNotParticipated.forEach((player) => {
            result[player.username] = {
                tokens: 3,
                bombs: 1,
                tokenCooldown: undefined,
                bombCooldown: undefined,
            };
        });

        const totalTokens = Object.values(result).reduce(
            (acc, available) => acc + available.tokens,
            0
        );

        const formattedTotalTokens = `Total tokens: \`${totalTokens}/${
            players.length * 3
        }\``;

        const totalBombs = Object.values(result).reduce(
            (acc, available) => acc + available.bombs,
            0
        );

        const formattedTotalBombs = `Total bombs: \`${totalBombs}/${players.length}\``;

        const table = Object.entries(result)
            .map(([userId, available]) => {
                let tokenIcon: string;
                if (available.tokens === 0) {
                    tokenIcon = "❌";
                } else if (available.tokens === 3) {
                    tokenIcon = "⚠️";
                } else {
                    tokenIcon = "✅";
                }

                if (!available.tokenCooldown)
                    available.tokenCooldown = "NO COOLDOWN";

                const tokenStatus = `${tokenIcon} \`${available.tokens}/3\` cooldown: \`${available.tokenCooldown}\``;

                const bombIcon = available.bombs > 0 ? "✅" : `❌`;

                let bombStatus: string;
                if (!available.bombCooldown) {
                    bombStatus = `${bombIcon} \`NOT USED YET\``;
                } else {
                    bombStatus = `${bombIcon} \`${
                        available.bombs > 0 ? "+" : "-"
                    }${available.bombCooldown}\``;
                }

                return {
                    text: `${tokenStatus} - Bomb: ${bombStatus} - **${userId}**`,
                    tokens: available.tokens,
                };
            })
            .sort((a, b) => b.tokens - a.tokens) // Sort by tokens descending
            .map((item) => item.text);

        if (table.length === 0) {
            await interaction.editReply({
                content: "No members have available tokens or bombs right now.",
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Available Tokens and Bombs")
            .setDescription(
                "Here is the list of members with available tokens and bombs:\n Note that the token cooldowns have a certain margin of error due to unknown variables in the calculation."
            )
            .setFields(
                {
                    name: "Total tokens",
                    value: formattedTotalTokens,
                    inline: true,
                },
                {
                    name: "Total bombs",
                    value: formattedTotalBombs,
                    inline: true,
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Data fetched from the guild raid API.\n(NB! Inaccuracies may occur for users who have joined mid-season)",
            });

        for (let i = 0; i < table.length; i += 10) {
            embed.addFields({
                name: "",
                value: table.slice(i, i + 10).join("\n"),
                inline: false,
            });
        }

        embed.addFields(
            {
                name: "Total tokens",
                value: formattedTotalTokens,
                inline: true,
            },
            {
                name: "Total bombs",
                value: formattedTotalBombs,
                inline: true,
            }
        );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(
            error,
            `Error occured in available-tokens-bombs by ${interaction.user.username}`
        );
        await interaction.editReply({
            content:
                "An error occurred while fetching the data. Please try again later or contact the Bot developer if the problem persists.",
        });
        return;
    }
}
