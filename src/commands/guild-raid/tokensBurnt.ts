import { logger } from "@/lib";
import {
    getCurrentSeason,
    MAXIMUM_TOKENS_PER_SEASON,
} from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService";
import { replaceUserIdKeysWithDisplayNames } from "@/lib/utils/userUtils";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("tokens-burnt")
    .setDescription(
        "See how many tokens each guild member has burned by hitting the cap this season.",
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const service = new GuildService();
    const discordId = interaction.user.id;
    const season = getCurrentSeason();

    logger.info(`${interaction.user.username} attempting to use /tokens-burnt`);

    try {
        let availability = await service.getAvailableTokensAndBombs(discordId);

        if (
            !availability ||
            typeof availability !== "object" ||
            Object.keys(availability).length === 0
        ) {
            await interaction.editReply({
                content:
                    "No availability data found for the current season. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const seasonResult = await service.getGuildRaidResultBySeason(
            discordId,
            season,
            undefined,
            true,
        );

        const tokensUsedMap: Record<string, number> = {};
        if (seasonResult) {
            for (const entry of seasonResult) {
                tokensUsedMap[entry.username] = entry.totalTokens || 0;
            }
        }

        const players = await service.fetchGuildMembers(discordId);
        if (!players) {
            await interaction.editReply({
                content:
                    "Something went wrong while fetching guild members from the game. Please try again or contact the support server if the issue persists.",
            });
            return;
        }

        availability = replaceUserIdKeysWithDisplayNames(
            availability,
            players,
            true,
        );

        const resolvedTokensUsed: Record<string, number> = {};
        for (const [userId, count] of Object.entries(tokensUsedMap)) {
            const player = players.find((p) => p.userId === userId);
            if (player) {
                resolvedTokensUsed[player.displayName] = count;
            }
        }

        const playersNotInAvailability = players.filter(
            (player) => !availability[player.displayName],
        );
        for (const player of playersNotInAvailability) {
            availability[player.displayName] = {
                tokens: 3,
                bombs: 1,
                tokenCooldown: undefined,
                bombCooldown: undefined,
            };
        }

        // Calculate the theoretical max tokens possible this season:
        // the highest (used + available) among all players.
        // Can't be higher than 28 over a season, though.
        // Only way someone reaches 29 is through a bug where data for a game crash is recorded but they were recharged a token from customer support.
        let maxPossible = Math.max(
            ...Object.entries(availability).map(([displayName, avail]) => {
                const used = resolvedTokensUsed[displayName] ?? 0;
                return used + avail.tokens;
            }),
        );

        if (maxPossible > MAXIMUM_TOKENS_PER_SEASON) {
            maxPossible = MAXIMUM_TOKENS_PER_SEASON;
        }

        const rows = Object.entries(availability)
            .map(([displayName, avail]) => {
                const used = resolvedTokensUsed[displayName] ?? 0;
                const burned = maxPossible - (used + avail.tokens);

                let icon: string;
                if (avail.tokens === 3 && used === 0) {
                    // Capped and hasn't played at all — most concerning
                    icon = "🔴";
                } else if (avail.tokens === 3) {
                    // Capped but has played this season
                    icon = "⚠️";
                } else if (avail.tokens === 0) {
                    // No tokens left, actively playing
                    icon = "✅";
                } else {
                    // Has some tokens, partially active
                    icon = "🔵";
                }

                let nToken: string;
                switch (avail.tokens) {
                    case 0:
                        nToken = "0";
                        break;
                    case 1:
                        nToken = "1";
                        break;
                    case 2:
                        nToken = "2";
                        break;
                    default:
                        nToken = "3";
                        break;
                }

                const burnedStr = burned > 0 ? `🔥\`${burned}\`` : `💧\`0\``;

                return {
                    text: `${icon} \`${nToken}/3\` avail · \`${String(used).padStart(2, " ")}\` used · ${burnedStr} burned — ${displayName}`,
                    tokens: avail.tokens,
                    used,
                    burned,
                };
            })
            .sort((a, b) => {
                // Sort by burned descending first, then available descending, then used ascending
                if (b.burned !== a.burned) return b.burned - a.burned;
                if (b.tokens !== a.tokens) return b.tokens - a.tokens;
                return a.used - b.used;
            })
            .map((item) => item.text);

        if (rows.length === 0) {
            await interaction.editReply({
                content: "No members found to display in the token overview.",
            });
            return;
        }

        const totalAvailable = Object.values(availability).reduce(
            (acc, a) => acc + a.tokens,
            0,
        );
        const totalUsed = Object.values(resolvedTokensUsed).reduce(
            (acc, n) => acc + n,
            0,
        );

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Token Overview — Season ${season}`)
            .setDescription(
                "Shows each member's **currently available** tokens, how many they've **used**, and how many they've **burned** this season.\n\n" +
                    "🔴 Capped & 0 used (inactive)\n" +
                    "⚠️ Capped (may be burning tokens)\n" +
                    "🔵 Has tokens available\n" +
                    "✅ All tokens spent\n" +
                    `🔥 Burned = tokens lost by staying capped too long (max possible: ${maxPossible})\n` +
                    `💧 No tokens burned`,
            )
            .setFields({
                name: "Overview",
                value: "",
            })
            .setTimestamp()
            .setFooter({
                text: "Players capped at 3/3 with low usage may have lost tokens by not refreshing in time.\nGleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support the bot development",
            });

        for (let i = 0; i < rows.length; i += 10) {
            embed.addFields({
                name: "",
                value: rows.slice(i, i + 10).join("\n"),
                inline: false,
            });
        }

        const totalBurned = Object.entries(availability).reduce(
            (acc, [displayName, avail]) => {
                const used = resolvedTokensUsed[displayName] ?? 0;
                return acc + (maxPossible - (used + avail.tokens));
            },
            0,
        );

        embed.addFields(
            {
                name: "Total available",
                value: `\`${totalAvailable}/${players.length * 3}\``,
                inline: true,
            },
            {
                name: "Total used this season",
                value: `\`${totalUsed}\``,
                inline: true,
            },
            {
                name: "Total burned",
                value: `\`${totalBurned}\` 🔥`,
                inline: true,
            },
            {
                name: "How are available tokens calculated?",
                value:
                    "Each player regenerates **1 token every 12 hours**, up to a cap of **3**. " +
                    "While at 3/3, regeneration is **paused** — no new tokens are earned until one is spent.\n\n" +
                    "The available count is estimated from each player's most recent token usage timestamps relative to the current time. " +
                    "Due to the granularity of the data, there is an inherent **±1 token uncertainty** per player.",
                inline: false,
            },
            {
                name: "How are burned tokens calculated?",
                value:
                    `We take the highest \`used + available\` across all members as the **max possible** tokens this season (\`${maxPossible}\`). ` +
                    "This represents the theoretical token count for someone who **never** sat at 3/3 long enough to miss a regeneration.\n\n" +
                    "A player's **burned** count = `max possible − (used + available)`.\n\n" +
                    "**Assumptions & caveats:**\n" +
                    "• At least one guild member has never lost a token to the cap — if *everyone* has burned tokens, all burn counts will be **underreported**.\n" +
                    "• The ±1 uncertainty on available tokens carries over to burned counts, so small values (especially `1`) may be noise.\n" +
                    `• Max possible is hard-capped at \`${MAXIMUM_TOKENS_PER_SEASON}\` to guard against data anomalies (e.g. customer support reimbursements).`,
                inline: false,
            },
        );

        await interaction.editReply({ embeds: [embed] });

        logger.info(
            `${interaction.user.username} successfully used /token-overview`,
        );
    } catch (error) {
        logger.error(
            error,
            `Error occurred in token-overview by ${interaction.user.username}`,
        );
        await interaction.editReply({
            content:
                "An error occurred while fetching the data. Please try again later or contact the Bot developer if the problem persists.",
        });
        return;
    }
}
