import { logger } from "@/lib";
import { handleCommandError } from "@/lib/utils/errorUtils";
import { miscEmojis, STANDARD_FOOTER_TEXT } from "@/lib/configs/constants";
import { GuildService } from "@/lib/services/GuildService";
import { AvailabilityService } from "@/lib/services/AvailabilityService";
import { RaidAnalyticsService } from "@/lib/services/RaidAnalyticsService";
import { replaceUserIdKeysWithDisplayNames } from "@/lib/utils/userUtils";
import { toMinutes, withinNextHour } from "@/lib/utils/timeUtils";
import {
    estimateBombDamage,
    estimateBombKillProbability,
    getPlayerAwakeWeights,
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

        if (Object.keys(result).length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the current season. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const players = await service.fetchGuildMembers(discordId);

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

        const raidAnalyticsService = new RaidAnalyticsService();

        const [guildLevel, bossUnits, activityProfile] = await Promise.all([
            service.getGuildLevel(discordId),
            availabilityService.getCurrentBossUnits(discordId),
            raidAnalyticsService.getActivityByHourPerPlayer(discordId),
        ]);
        const bombEstimate =
            totalBombs > 0 && guildLevel
                ? estimateBombDamage(totalBombs, guildLevel)
                : null;

        // Calculate awake player weights based on activity patterns
        const currentHour = new Date().getUTCHours();
        const awakeWeights = getPlayerAwakeWeights(
            activityProfile,
            currentHour,
        );

        // Map userId weights to displayName weights
        const awakeWeightsByName: Record<string, number> = {};
        for (const player of players) {
            awakeWeightsByName[player.displayName] =
                awakeWeights[player.userId] ?? 1.0;
        }

        // Compute weighted awake bomb count
        const awakeBombs = Object.entries(result).reduce(
            (acc, [name, available]) => {
                const weight = awakeWeightsByName[name] ?? 1.0;
                return acc + available.bombs * weight;
            },
            0,
        );
        const awakeBombsLow = Math.floor(awakeBombs);
        const awakeBombsHigh = Math.ceil(awakeBombs);
        const awakeBombEstimate =
            awakeBombsLow > 0 && guildLevel
                ? estimateBombDamage(awakeBombsLow, guildLevel)
                : null;
        const awakeBombEstimateHigh =
            awakeBombsHigh > 0 && guildLevel
                ? estimateBombDamage(awakeBombsHigh, guildLevel)
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

                const weight = awakeWeightsByName[userId] ?? 1.0;
                const activityIndicator =
                    weight === 0 ? " 💤" : weight === 0.5 ? " ⏰" : " ✨";

                return {
                    text: `${bombStatus} - ${userId}${activityIndicator}`,
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
                              (bossUnits.some(
                                  (u) => u.encounterType === EncounterType.BOSS,
                              )
                                  ? ""
                                  : `${bossUnits[0]?.type ?? "Boss"}: \`Full HP\`\n`) +
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
                                          `${bossUnits[0]?.type} Unknown Prime: \`Full HP\``,
                                  )
                                  .join("\n")
                                  .replace(/^(?=.)/, "\n"),
                          inline: false,
                      },
                  ]
                : []),
            ...(awakeBombEstimate &&
            guildLevel &&
            bossUnits &&
            totalBombs !== awakeBombsLow
                ? [
                      {
                          name: `Active players estimate (${currentHour}:00 UTC) — ✨ active, ⏰ possibly active, 💤 inactive`,
                          value:
                              `Bombs: \`${awakeBombsLow}${awakeBombsLow !== awakeBombsHigh ? `-${awakeBombsHigh}` : ""}\`\n` +
                              `Damage: \`${awakeBombEstimate.avgDamage.toLocaleString()}${awakeBombEstimateHigh ? `-${awakeBombEstimateHigh.avgDamage.toLocaleString()}` : ""}\` avg\n` +
                              bossUnits
                                  .filter((u) => u.remainingHp > 0)
                                  .map((unit) => {
                                      const label =
                                          unit.encounterType ===
                                          EncounterType.BOSS
                                              ? unit.type
                                              : getPrimeDisplayName(
                                                    unit.unitId,
                                                );
                                      const probLow =
                                          estimateBombKillProbability(
                                              unit.remainingHp,
                                              awakeBombsLow,
                                              guildLevel,
                                          );
                                      const probHigh =
                                          estimateBombKillProbability(
                                              unit.remainingHp,
                                              awakeBombsHigh,
                                              guildLevel,
                                          );
                                      const display =
                                          probLow === probHigh
                                              ? `${(probLow * 100).toFixed(1)}%`
                                              : `${(probLow * 100).toFixed(1)}-${(probHigh * 100).toFixed(1)}%`;
                                      return `${label}: \`${display}\``;
                                  })
                                  .join("\n"),
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
        await handleCommandError(interaction, error);
    }
}
