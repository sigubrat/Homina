import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { replaceUserIdKeysWithDisplayNames } from "@/lib/utils/userUtils";
import { withinNextHour } from "@/lib/utils/timeUtils";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("available-bombs")
    .setDescription("See who has bombs available")
    .addBooleanOption((option) =>
        option
            .setName("soon")
            .setDescription("Include players with bombs ready in an hour")
            .setRequired(false),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();

    logger.info(`${interaction.user.id} attempting to use /available-bombs`);

    const soon = interaction.options.getBoolean("soon", false) ?? false;
    const discordId = interaction.user.id;

    try {
        let result = await service.getAvailableBombs(discordId);

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

        const players = await service.fetchGuildMembers(discordId);
        if (!players) {
            await interaction.editReply({
                content:
                    "Something went wrong while fetching guild members from the game. Please try again or contact the support server if the issue persists",
            });
            return;
        }

        // Replace User IDs with display names in the result
        result = replaceUserIdKeysWithDisplayNames(result, players, true);

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

        const totalBombs = Object.values(result).reduce(
            (acc, available) => acc + available.bombs,
            0,
        );

        let maxBombs = Object.keys(result).length;
        maxBombs = maxBombs > 30 ? 30 : maxBombs;

        const formattedTotalBombs = `Total bombs: \`${totalBombs}/${maxBombs}\``;

        const table = Object.entries(result)
            .map(([userId, available]) => {
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
                    text: `${bombStatus} - ${userId}`,
                    bombs: available.bombs,
                };
            })
            .sort((a, b) => b.bombs - a.bombs)
            .map((item) => item.text);

        if (table.length === 0) {
            await interaction.editReply({
                content: "No members have available bombs right now.",
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Available Bombs")
            .setDescription("Here is the list of members with available bombs.")
            .setTimestamp()
            .setFooter({
                text: "Gleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support the bot development",
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
                name: "Total bombs",
                value: formattedTotalBombs,
                inline: true,
            },
            {
                name: "Copy players with available bombs",
                value:
                    "```" +
                    (Object.entries(result)
                        .filter(([, available]) => available.bombs > 0)
                        .map(([username]) => `@${username} `)
                        .join("\n") || "None") +
                    "```",
            },
        );

        if (soon) {
            embed.addFields({
                name: "Copy players with bombs available in less than an hour",
                value:
                    "```" +
                    (Object.entries(result)
                        .filter(
                            ([, available]) =>
                                available.bombs == 0 &&
                                available.bombCooldown &&
                                withinNextHour(available.bombCooldown),
                        )
                        .map(([username]) => `@${username}`)
                        .join("\n") || "None") +
                    "```",
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(
            error,
            `${interaction.user.id} failed to use /available-bombs`,
        );
        await interaction.editReply(
            "There was an error while fetching available bombs.",
        );
    }
}
