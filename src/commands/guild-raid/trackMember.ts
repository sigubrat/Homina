import { logger } from "@/lib";
import {
    MAXIMUM_GUILD_MEMBERS,
    MAXIMUM_TOKENS_PER_SEASON,
} from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService";
import { numericAverage, numericMedian } from "@/lib/utils";
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
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON }
            );
    })
    .addStringOption((option) =>
        option
            .setName("average-method")
            .setChoices(
                {
                    name: "Mean",
                    value: "mean",
                },
                {
                    name: "Median",
                    value: "median",
                }
            )
            .setDescription(
                "Median is recommended if you have big variation in damage, mean otherwise"
            )
            .setRequired(false)
    )
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

        const avgMethod = interaction.options.getString("average-method") as
            | "mean"
            | "median"
            | undefined;
        const embed = new EmbedBuilder()
            .setTitle(`Guild Raid Stats for ${member}`)
            .setDescription(
                `Here are the guild raid stats for **${member}** over the last ${N_SEASONS} seasons.\n` +
                    "*Nb! Does not include inactive members in a season as it can only know who participated in prior seasons. This affects the average value if you had inactive players.*\n\n" +
                    "Data includes primes."
            )
            .addFields(
                {
                    name: "Rarity filter",
                    value: rarity ?? "No filter applied",
                },
                {
                    name: "Average method",
                    value: avgMethod
                        ? `Using ${avgMethod} to calculate averages`
                        : "No average method specified, using mean",
                }
            )
            .setColor("#0099ff")
            .setTimestamp();

        if (rarity) {
            embed.addFields({
                name: `Rarity: ${rarity}`,
                value: "Rarity filter applied and the damage a user did to a boss relative to the avg total damage dealt by the guild will be displayed",
            });
        }

        for (const [season, stats] of Object.entries(data)) {
            if (!stats) {
                continue;
            }

            // If rarity is not provided, we don't need to calculate relative damage for each boss
            const vals = Object.values(stats).flat();

            const damagePerMember: Record<string, number> = {};
            const tokensPerMember: Record<string, number> = {};

            for (const entry of vals) {
                if (entry?.username) {
                    damagePerMember[entry.username] =
                        (damagePerMember[entry.username] || 0) +
                        (entry.totalDamage || 0);
                    tokensPerMember[entry.username] =
                        (tokensPerMember[entry.username] || 0) +
                        (entry.totalTokens || 0);
                }
            }

            const allMemberDamages = Object.values(damagePerMember);
            const allMemberTokens = Object.values(tokensPerMember);

            const guildAverageDamage = (
                avgMethod === "median" ? numericMedian : numericAverage
            )(allMemberDamages);
            let guildAverageTokens = (
                avgMethod === "median" ? numericMedian : numericAverage
            )(allMemberTokens);

            if (guildAverageTokens > MAXIMUM_TOKENS_PER_SEASON) {
                guildAverageTokens = MAXIMUM_TOKENS_PER_SEASON;
            }

            const userDamage = damagePerMember[memberId] || 0;
            const userTokens = tokensPerMember[memberId] || 0;

            const relativeDamage =
                guildAverageDamage > 0
                    ? ((userDamage / guildAverageDamage) * 100).toFixed(1) + "%"
                    : "N/A";

            const relativeTokens =
                guildAverageTokens > 0
                    ? ((userTokens / guildAverageTokens) * 100).toFixed(1) + "%"
                    : "N/A";

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
                        { maximumFractionDigits: 1 }
                    )}\` — User tokens: \`${userTokens}\` — Relative Tokens: \`${relativeTokens}\``,
                });
            } else {
                // If rarity is provided, we need to calculate relative damage for each boss
                const userStatsPerBoss: Record<string, string[]> = {};
                for (const [boss, values] of Object.entries(stats)) {
                    if (!values || values.length === 0) {
                        continue;
                    }

                    const userData = values.find(
                        (v) => v.username === memberId
                    );

                    if (!userData) {
                        continue;
                    }
                    let nPlayers = new Set<string>(
                        values.map((v) => v.username)
                    ).size;

                    if (nPlayers > MAXIMUM_GUILD_MEMBERS) {
                        nPlayers = MAXIMUM_GUILD_MEMBERS;
                    }

                    const totalDamage = values.map((v) => v.totalDamage || 0);

                    const avgDamage =
                        avgMethod === "mean"
                            ? totalDamage.reduce((a, b) => a + b, 0) / nPlayers
                            : numericMedian(totalDamage);

                    const userDamage = userData.totalDamage || 0;
                    const userTokens = userData.totalTokens || 0;

                    if (userTokens === 0) {
                        continue;
                    }

                    const userAvg = (userDamage / userTokens).toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 1,
                        }
                    );

                    const relativeDamage =
                        ((userDamage / avgDamage) * 100).toLocaleString(
                            undefined,
                            {
                                maximumFractionDigits: 1,
                            }
                        ) + "%";

                    const bossName =
                        rarity[0]! +
                        userData.set +
                        " " +
                        boss.split(/(?=[A-Z])/)[0]?.substring(0, 4);

                    const maxDmg = (userData.maxDmg || 0).toLocaleString(
                        undefined,
                        {
                            maximumFractionDigits: 0,
                        }
                    );

                    userStatsPerBoss[bossName] = [
                        userAvg,
                        relativeDamage,
                        maxDmg,
                    ];
                }

                const bossRelativeStrings = Object.entries(userStatsPerBoss)
                    .map(([bossname, user]) => {
                        const userAvgStr = user[0];
                        const userRelativeTotal = user[1];
                        const userMaxDmg = user[2];
                        return `${bossname.padEnd(8)} ${userAvgStr!.padStart(
                            10
                        )} ${userRelativeTotal!.padStart(
                            8
                        )} ${userMaxDmg!.padStart(10)}`;
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
                        { maximumFractionDigits: 1 }
                    )}\` — User tokens: \`${userTokens}\` — Relative Tokens: \`${relativeTokens}\`
                    \`\`\`${"Boss".padEnd(6)} ${"User Avg".padEnd(
                        10
                    )} ${"Rel. total".padEnd(12)} ${"Max Dmg".padEnd(
                        8
                    )}\n${bossRelativeStrings}\`\`\``,
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
