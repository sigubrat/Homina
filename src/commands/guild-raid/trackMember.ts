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
        "Track a member's guild raid stats over the last 3 seasons"
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

        if (!data || Object.keys.length === 0) {
            await interaction.editReply({
                content: `No data found for the member ${member} in the last ${N_SEASONS} seasons.`,
            });
            return;
        }

        const memberList = await service.getGuildMembers(userId);

        if (!memberList || memberList.length === 0) {
            await interaction.editReply({
                content:
                    "No members found in the guild. Please make sure you have registered your API-token.",
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Guild Raid Stats for ${member}`)
            .setDescription(
                `Here are the guild raid stats for ${member} over the last ${N_SEASONS} seasons.`
            )
            .setColor("#0099ff")
            .setTimestamp();

        for (const [season, stats] of Object.entries(data)) {
            if (!stats) {
                continue;
            }

            // If rarity is not provided, we don't need to calculate relative damage for each boss
            if (!rarity) {
                const vals = Object.values(stats).flat();

                const allDamage = Object.values(vals)
                    .map((season) => season?.totalDamage || 0)
                    .reduce((a, b) => a + b, 0);

                const allTokens = Object.values(vals)
                    .map((season) => season?.totalTokens || 0)
                    .reduce((a, b) => a + b, 0);

                const guildAverageDamage = allDamage / memberList.length;

                const guildAverageTokens = allTokens / memberList.length;

                const userData = Object.values(vals).filter(
                    (season) => season?.username === member
                );
                const userDamage = userData
                    .map((season) => season.totalDamage || 0)
                    .reduce((a, b) => a + b, 0);

                const userTokens = userData
                    .map((season) => season.totalTokens || 0)
                    .reduce((a, b) => a + b, 0);

                const relativeDamage = (
                    userDamage / guildAverageDamage
                ).toFixed(1);

                const relativeTokens = (
                    userTokens / guildAverageTokens
                ).toFixed(1);

                embed.addFields({
                    name: `Season ${season}`,
                    value: `Total Damage: \`${userDamage.toLocaleString()}\` — Total Tokens: \`${userTokens.toLocaleString()}\`
                    Guild avg dmg: \`${guildAverageDamage.toLocaleString(
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
                    )}\` — User tokens: \`${userTokens}\` Relative Tokens: \`${relativeTokens}\``,
                });
            } else {
                // const formattedDamage = stats.totalDamage.toLocaleString();
                // const formattedTokens = stats.totalTokens.toLocaleString();
                // const formattedMax =
                //     stats.maxDmg?.toLocaleString("default", {
                //         maximumFractionDigits: 1,
                //     }) ?? "N/A";
                // const formattedMin =
                //     stats.minDmg?.toLocaleString("default", {
                //         maximumFractionDigits: 1,
                //     }) ?? "N/A";
                // const formattedAvg = (
                //     stats.totalDamage /
                //     (stats.totalTokens > 0 ? stats.totalTokens : 1)
                // ).toLocaleString("default", {
                //     maximumFractionDigits: 1,
                // });
                // embed.addFields({
                //     name: `Season ${season}`,
                //     value: `Total Damage: \`${formattedDamage}\` — Total Tokens: \`${formattedTokens}\` — Avg: \`${formattedAvg}\`\nMax damage: \`${formattedMax}\` — Min damage: \`${formattedMin}\``,
                // });
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
