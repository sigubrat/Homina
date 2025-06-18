import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { Rarity } from "@/models/enums";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

const N_SEASONS = 5;

export const data = new SlashCommandBuilder()
    .setName("track-member")
    .addStringOption((option) =>
        option
            .setName("member")
            .setDescription("The member to track")
            .setRequired(true)
    )
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
    })
    .setDescription(
        `Track a member's guild raid stats over the last ${N_SEASONS} seasons`
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const member = interaction.options.getString("member");
    if (!member || member.length === 0) {
        await interaction.editReply({
            content: "Invalid member name. Please provide a valid member.",
        });
        return;
    }

    const userId = interaction.user.id;

    const service = new GuildService();

    try {
        const guildId = await service.getGuildId(userId);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not find your guild. Please make sure you have registered a guild API token to this discord user.",
            });
            return;
        }

        const memberId = await service.getPlayerIdByUsername(member, guildId);

        if (!memberId) {
            await interaction.editReply({
                content: `Could not find the username ${member} in the guild. Please make sure the usernames are updated in the bot and that you provided a correct one.`,
            });
            return;
        }

        const rarity = interaction.options.getString("rarity") as
            | Rarity
            | undefined;

        const data = await service.getMemberStatsInLastSeasons(
            userId,
            N_SEASONS,
            rarity
        );

        if (!data || Object.keys(data).length === 0) {
            await interaction.editReply({
                content: `No data found for the member ${member} in the last ${N_SEASONS} seasons.`,
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Guild Raid Stats for ${member}`)
            .setDescription(
                `Here are the guild raid stats for **${member}** over the last ${N_SEASONS} seasons.
                
                *Nb! Does not include inactive members in a season as it can only know who participated in prior seasons. This affects the average value if you had inactive players.*
                `
            )
            .addFields({
                name: "Rarity filter",
                value: rarity ?? "No filter applied",
            })
            .setColor("#0099ff")
            .setTimestamp();

        for (const [season, stats] of Object.entries(data)) {
            if (!stats) {
                continue;
            }

            // If rarity is not provided, we don't need to calculate relative damage for each boss
            const vals = Object.values(stats).flat();

            const allDamage = Object.values(vals)
                .map((season) => season?.totalDamage || 0)
                .reduce((a, b) => a + b, 0);

            const allTokens = Object.values(vals)
                .map((season) => season?.totalTokens || 0)
                .reduce((a, b) => a + b, 0);

            const nMembers = new Set<string>(
                vals.map((entry) => entry?.username)
            ).size;

            const guildAverageDamage = allDamage / nMembers;

            const guildAverageTokens = allTokens / nMembers;

            const userData = Object.values(vals).filter(
                (season) => season?.username === member
            );
            const userDamage = userData
                .map((season) => season.totalDamage || 0)
                .reduce((a, b) => a + b, 0);

            const userTokens = userData
                .map((season) => season.totalTokens || 0)
                .reduce((a, b) => a + b, 0);

            const relativeDamage =
                ((userDamage / guildAverageDamage) * 100).toFixed(1) + "%";

            const relativeTokens =
                ((userTokens / guildAverageTokens) * 100).toFixed(1) + "%";

            if (!rarity) {
                embed.addFields({
                    name: `Season ${season}`,
                    value: `Guild avg dmg: \`${guildAverageDamage.toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 0,
                        }
                    )}\` — User dmg: \`${userDamage.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                    })}\` — Relative Damage: \`${relativeDamage}\`
                    Guild avg token: \`${guildAverageTokens.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 0 }
                    )}\` — User tokens: \`${userTokens}\` — Relative Tokens: \`${relativeTokens}\``,
                });
            } else {
                // If rarity is provided, we need to calculate relative damage for each boss
                const userStatsPerBoss: Record<string, string[]> = {};
                for (const [boss, values] of Object.entries(stats)) {
                    if (!values || values.length === 0) {
                        continue;
                    }
                    const userData = values.find((v) => v.username === member);

                    if (!userData) {
                        continue;
                    }
                    const nPlayers = new Set<string>(
                        values.map((v) => v.username)
                    ).size;

                    const totalDamage = values
                        .map((v) => v.totalDamage || 0)
                        .reduce((a, b) => a + b, 0);

                    const avgDamage = totalDamage / nPlayers;

                    const userDamage = userData.totalDamage || 0;
                    const userTokens = userData.totalTokens || 0;
                    const userAvg =
                        userTokens > 0
                            ? (userDamage / userTokens).toLocaleString(
                                  undefined,
                                  {
                                      maximumFractionDigits: 1,
                                  }
                              )
                            : "0";

                    const relativeDamage =
                        ((userDamage / avgDamage) * 100).toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits: 1,
                            }
                        ) + "%";

                    userStatsPerBoss[boss] = [userAvg, relativeDamage];
                }

                const bossRelativeStrings = Object.entries(userStatsPerBoss)
                    .map(([boss, user], idx) => {
                        const bossName =
                            rarity[0]! +
                            (idx + 1) +
                            " " +
                            boss.split(/(?=[A-Z])/)[0]?.substring(0, 4);
                        const userAvgStr = user[0];
                        const userRelativeTotal = user[1];
                        return `${bossName.padEnd(8)} ${userAvgStr!.padStart(
                            10
                        )} ${userRelativeTotal!.padStart(8)}`;
                    })
                    .join("\n");

                embed.addFields({
                    name: `Season ${season}`,
                    value: `Guild avg dmg: \`${guildAverageDamage.toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 0,
                        }
                    )}\` — User dmg: \`${userDamage.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                    })}\` — Relative Damage: \`${relativeDamage}\`
                    Guild avg token: \`${guildAverageTokens.toLocaleString(
                        undefined,
                        { maximumFractionDigits: 0 }
                    )}\` — User tokens: \`${userTokens}\` — Relative Tokens: \`${relativeTokens}\`
                    \`\`\`${"Boss".padEnd(6)} ${"User Avg".padEnd(
                        12
                    )} Rel. total\n${bossRelativeStrings}\`\`\``,
                });
            }
        }

        await interaction.editReply({
            embeds: [embed],
        });
    } catch (error) {
        logger.error(error, `Error tracking member ${member}`);
        await interaction.editReply({
            content:
                "An error occurred while tracking the member. Please check that the username is correct and updated in the bot, then try again.",
        });
    }
}
