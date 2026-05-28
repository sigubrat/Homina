import { logger } from "@/lib";
import { miscEmojis, STANDARD_FOOTER_TEXT } from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService";
import { AvailabilityService } from "@/lib/services/AvailabilityService";
import { replaceUserIdKeysWithDisplayNames } from "@/lib/utils/userUtils";
import { toMinutes, withinNextHour } from "@/lib/utils/timeUtils";
import {
    estimateBombDamage,
    estimateBombKillProbability,
} from "@/lib/utils/mathUtils";
import { getPrimeDisplayName } from "@/lib/utils/utils";
import { EncounterType } from "@/models/enums";
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
    const availabilityService = new AvailabilityService();

    logger.info(`${interaction.user.id} attempting to use /available-bombs`);

    const soon = interaction.options.getBoolean("soon", false) ?? false;
    const discordId = interaction.user.id;

    try {
        let result =
            await availabilityService.getAvailableBombsWithMetadata(discordId);

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

        const formattedTotalBombs = `${miscEmojis.bomb} \`${totalBombs}/${maxBombs}\``;

        const [guildLevel, bossUnits] = await Promise.all([
            service.getGuildLevel(discordId),
            availabilityService.getCurrentBossUnits(discordId),
        ]);
        const bombEstimate =
            totalBombs > 0 && guildLevel
                ? estimateBombDamage(totalBombs, guildLevel)
                : null;

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
            .sort((a, b) => {
                const byBomb = b.bombs - a.bombs;
                if (byBomb !== 0) return byBomb;
                return toMinutes(b.text) - toMinutes(a.text);
            })
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
                text: STANDARD_FOOTER_TEXT,
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
                name: "Estimated total bomb damage based on your guild level and available bombs",
                value: `Min: \`${bombEstimate?.minDamage.toLocaleString()}\` \nAvg: \`${bombEstimate?.avgDamage.toLocaleString()}\` \nMax: \`${bombEstimate?.maxDamage.toLocaleString()}\``,
                inline: false,
            },
            ...(totalBombs > 0 && guildLevel && bossUnits
                ? [
                      {
                          name: "Boss kill chance with available bombs",
                          value:
                              bossUnits
                                  .map((unit) => {
                                      const label =
                                          unit.encounterType ===
                                          EncounterType.BOSS
                                              ? unit.type
                                              : `${getPrimeDisplayName(unit.unitId)}`;
                                      if (unit.remainingHp === 0) {
                                          return `${label}: \`Dead ☠️\``;
                                      }
                                      const prob = estimateBombKillProbability(
                                          unit.remainingHp,
                                          totalBombs,
                                          guildLevel,
                                      );
                                      const probDisplay =
                                          prob === 0
                                              ? "Not possible ❌"
                                              : `${(prob * 100).toFixed(1)}%`;
                                      return `${label}: \`${unit.remainingHp.toLocaleString()} HP\` → \`${probDisplay}\``;
                                  })
                                  .join("\n") +
                              Array.from({
                                  length:
                                      2 -
                                      bossUnits.filter(
                                          (u) =>
                                              u.encounterType ===
                                              EncounterType.SIDE_BOSS,
                                      ).length,
                              })
                                  .map(
                                      () =>
                                          `${bossUnits[0]?.type ?? "Side Boss"} Side: \`Full HP\``,
                                  )
                                  .join("\n")
                                  .replace(/^(?=.)/, "\n"),
                          inline: false,
                      },
                  ]
                : []),
            {
                name: "Copy players with available bombs",
                value:
                    "`" +
                    (Object.entries(result)
                        .filter(([, available]) => available.bombs > 0)
                        .map(([username]) => `@${username}`)
                        .join(" ") || "None") +
                    "`",
            },
        );

        if (soon) {
            embed.addFields({
                name: "Copy players with bombs available in less than an hour",
                value:
                    "`" +
                    (Object.entries(result)
                        .filter(
                            ([, available]) =>
                                available.bombs == 0 &&
                                available.bombCooldown &&
                                withinNextHour(available.bombCooldown),
                        )
                        .map(([username]) => `@${username}`)
                        .join(" ") || "None") +
                    "`",
            });
        }

        embed.addFields({
            name: "📋 How to copy",
            value:
                "**Windows/Mac**: Click and drag to select → `Ctrl+C`\n" +
                "**iPhone**: Click the text\n" +
                "**Android**: Long-press the text",
        });

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
