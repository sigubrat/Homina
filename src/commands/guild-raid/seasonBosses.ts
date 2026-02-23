import { logger } from "@/lib";
import { GRConfigService } from "@/lib/services/GRConfigService";
import { GuildService } from "@/lib/services/GuildService";
import { getBossEmoji } from "@/lib/utils/utils";
import { Rarity } from "@/models/enums";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("season-bosses")
    .setDescription("Get the guild boss configs for the previous seasons")
    .addStringOption((option) => {
        return option
            .setName("rarity")
            .setDescription("The rarity of the boss")
            .setRequired(false)
            .addChoices(
                { name: "Legendary+", value: Rarity.LEGENDARY_PLUS },
                { name: "Mythic", value: Rarity.MYTHIC },
                { name: "Legendary", value: Rarity.LEGENDARY },
                { name: "Epic", value: Rarity.EPIC },
                { name: "Rare", value: Rarity.RARE },
                { name: "Uncommon", value: Rarity.UNCOMMON },
                { name: "Common", value: Rarity.COMMON },
            );
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});

    const discordId = interaction.user.id;

    const guildService = new GuildService();
    const rarity = interaction.options.getString("rarity") as
        | Rarity
        | undefined;

    try {
        const configs = await guildService.getNLastSeasonConfigs(discordId, 5);
        if (configs === null || configs.length === 0) {
            await interaction.editReply({
                content:
                    "Could not fetch data for you. Ensure your token is valid.",
            });
        }

        const configService = GRConfigService.getInstance();

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle(`Guild Boss Configs for the last seasons`)
            .setDescription(
                `Here are the bosses for the last ${configs?.length} seasons.
                
                (Tervigon and Hive Tyrant use the same emoji because who cares about them anyway?)`,
            )
            .setTimestamp()
            .setFooter({
                text: "Gleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support the bot development",
            });

        if (rarity) {
            embed.addFields({
                name: `Rarity: ${rarity}`,
                value: rarity,
            });
        }

        const seasons = configs!.map((season) => {
            const config = configService.getConfig(season.config);
            if (!config) {
                return;
            }
            return {
                season: season.season,
                config: config,
            };
        });

        if (!seasons || seasons.length === 0) {
            await interaction.editReply({
                content: "No configs found for the specified rarity.",
            });
            return;
        }

        seasons.forEach((season) => {
            if (season) {
                const rarities = Object.keys(season.config);
                const bosses = rarities
                    .map((r) => {
                        const matchRarities = rarity
                            ? rarity === Rarity.LEGENDARY_PLUS
                                ? [
                                      Rarity.LEGENDARY as string,
                                      Rarity.MYTHIC as string,
                                  ]
                                : [rarity as string]
                            : null;
                        if (matchRarities && !matchRarities.includes(r)) {
                            return;
                        }
                        const bossList =
                            season.config[r as keyof typeof season.config];
                        if (bossList && bossList.length > 0) {
                            return `**${r.at(0)}**: ${bossList
                                .map((b) => getBossEmoji(b))
                                .join("->")}`;
                        }
                        return `**${r}**: No bosses configured`;
                    })
                    .join("\n");
                embed.addFields({
                    name: `Season ${season.season}`,
                    value: bosses,
                });
            }
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(
            error,
            `Error while executing /season-configs command for ${interaction.user.username}`,
        );
    }
}
