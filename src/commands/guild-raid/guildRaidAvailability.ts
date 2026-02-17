import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { replaceUserIdKeysWithDisplayNames } from "@/lib/utils/userUtils";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("gr-availability")
    .setDescription(
        "Get an overview of how many guild raid tokens and bombs each member has available",
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();

    logger.info(
        `${interaction.user.username} attempting to use /available-tokens-bombs`,
    );

    try {
        let result = await service.getAvailableTokensAndBombs(
            interaction.user.id,
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

        const players = await service.fetchGuildMembers(interaction.user.id);
        if (!players) {
            await interaction.editReply({
                content:
                    "Something went wrong while fetching guild members from the game. Please try again or contact the support server if the issue persists",
            });
            return;
        }

        // Replace User IDs with display names in the result
        result = replaceUserIdKeysWithDisplayNames(result, players);

        // Add players who have not used any tokens or bombs yet
        const playersNotParticipated = players.filter(
            (player) => !result[player.displayName],
        );

        playersNotParticipated.forEach((player) => {
            result[player.displayName] = {
                tokens: 3,
                bombs: 1,
                tokenCooldown: undefined,
                bombCooldown: undefined,
            };
        });

        const totalTokens = Object.values(result).reduce(
            (acc, available) => acc + available.tokens,
            0,
        );

        const formattedTotalTokens = `Total tokens: \`${totalTokens}/${
            players.length * 3
        }\``;

        const totalBombs = Object.values(result).reduce(
            (acc, available) => acc + available.bombs,
            0,
        );

        let maxBombs = Object.keys(result).length;
        maxBombs = maxBombs > 30 ? 30 : maxBombs;

        const formattedTotalBombs = `Total bombs: \`${totalBombs}/${maxBombs}\``;

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
                let nToken: string;
                switch (available.tokens) {
                    case 0:
                        nToken = "0";
                        break;
                    case 1:
                        nToken = "⅓";
                        break;
                    case 2:
                        nToken = "⅔";
                        break;
                    default:
                        nToken = "3⁄3";
                        break;
                }

                if (!available.tokenCooldown)
                    available.tokenCooldown = "NONE..";
                else {
                    available.tokenCooldown = available.tokenCooldown
                        .slice(0, -4)
                        .replace(" ", "");
                }

                const tokenStatus = `${tokenIcon} ${nToken} \`${available.tokenCooldown}\``;

                const bombIcon = available.bombs > 0 ? "✅" : `❌`;

                let bombStatus: string;
                if (!available.bombCooldown) {
                    bombStatus = `${bombIcon} \`READY..\``;
                } else {
                    bombStatus = `${bombIcon} \`${
                        available.bombs > 0 ? "+" : "-"
                    }${available.bombCooldown.slice(0, -4).replace(" ", "")}\``;
                }

                return {
                    text: `${tokenStatus} - ${bombStatus} - ${userId}`,
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
                "Here is the list of members with available tokens and bombs.\n\n" +
                    "Note that the token cooldowns have an inherit uncertainty due to the nature of the available data for the calculation.\nIn certain cases the cooldown might not be accurate.\n\n" +
                    "First values are tokens, second values are bombs, then usernames.",
            )
            .setTimestamp()
            .setFooter({
                text: "Data fetched from the guild raid API.\n(NB! Inaccuracies may occur for users who have joined mid-season)\nGleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support me",
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
            },
        );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(
            error,
            `Error occured in available-tokens-bombs by ${interaction.user.username}`,
        );
        await interaction.editReply({
            content:
                "An error occurred while fetching the data. Please try again later or contact the Bot developer if the problem persists.",
        });
        return;
    }
}
