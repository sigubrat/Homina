import { logger } from "@/lib";
import {
    getCurrentSeason,
    MINIMUM_SEASON_THRESHOLD,
} from "@/lib/configs/constants";
import { DataTransformationService } from "@/lib/services/DataTransformationService";
import { GuildService } from "@/lib/services/GuildService";
import { splitByCapital } from "@/lib/utils/utils";
import { isInvalidSeason, SecondsToString } from "@/lib/utils/timeUtils";
import { Rarity } from "@/models/enums";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Pagination } from "pagination.djs";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("gr-time-used")
    .setDescription(
        "See how long it takes to to complete each raid boss in a given season",
    )
    .addNumberOption((option) =>
        option
            .setName("season")
            .setDescription("The season number (defaults to current season)")
            .setRequired(false)
            .setMinValue(MINIMUM_SEASON_THRESHOLD),
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
                { name: "Common", value: Rarity.COMMON },
            );
    })
    .addBooleanOption((option) =>
        option
            .setName("separate-primes")
            .setDescription("Show primes separately (default: false)")
            .setRequired(false),
    )
    .addBooleanOption((option) =>
        option
            .setName("show-delta")
            .setDescription(
                "Show the delta between times, tokens and bombs used each loop",
            )
            .setRequired(false),
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const discordID = interaction.user.id;
    const showDelta = interaction.options.getBoolean("show-delta") ?? false;

    const providedSeason = interaction.options.getNumber("season");
    const season = providedSeason ?? getCurrentSeason();

    if (providedSeason !== null && isInvalidSeason(providedSeason)) {
        await interaction.editReply({
            content: `Please provide a valid season number greater than or equal to ${MINIMUM_SEASON_THRESHOLD}. The current season is ${getCurrentSeason()}`,
        });
        return;
    }

    const rarity = interaction.options.getString("rarity") as Rarity;

    const separatePrimes =
        interaction.options.getBoolean("separate-primes") ?? false;

    const service = new GuildService();
    const transformer = new DataTransformationService();

    logger.info(
        `${interaction.user.username} attempting to use /gr-time-used ${season} ${rarity}`,
    );

    try {
        const seasonData = await service.getGuildRaidBySeason(
            discordID,
            season,
            rarity,
        );

        if (!seasonData || seasonData.length === 0) {
            await interaction.editReply({
                content:
                    "No data found for the specified season or the user has not participated.",
            });
            return;
        }
        const [transformedData, totalTime] = await transformer.timeUsedPerBoss(
            seasonData,
            separatePrimes,
        );

        const seasonDisplay =
            providedSeason === null
                ? `${season} (current season)`
                : `${season}`;

        const pagination = new Pagination(interaction, {
            limit: separatePrimes ? 10 : 25, // Adjust limit based on rarity
        })
            .setColor("#0099ff")
            .setTitle(`Time Used Per Boss in season ${seasonDisplay}`)
            .setDescription(
                `See how long it took your guild to defeat each boss`,
            )
            .setFields(
                {
                    name: "Season",
                    value: seasonDisplay,
                    inline: true,
                },
                {
                    name: "Time spent :clock:",
                    value: totalTime,
                    inline: true,
                },
                {
                    name: "Rarity",
                    value: rarity ? rarity : "All Rarities",

                    inline: true,
                },
                {
                    name: "Separate Primes",
                    value: separatePrimes ? "Yes" : "No",
                    inline: false,
                },
            )
            .setTimestamp();

        if (showDelta) {
            pagination.addFields({
                name: "Show delta",
                value: "Delta enabled. All delta values displayed for looped bosses use the first run as the baseline.",
            });
        }

        const entries = Object.entries(transformedData);
        // entries.sort(([a], [b]) => a.slice(0, 2).localeCompare(b.slice(0, 2)));
        for (const [boss, data] of entries) {
            // When splitting primes, skip the prime‐only entries
            if (separatePrimes && data.sideboss[0]) continue;

            let value: string;
            if (separatePrimes) {
                // Build sideboss block under the main boss
                const sidebosses = Object.entries(transformedData)
                    .filter(([, d]) => d.sideboss[0] && d.sideboss[1] === boss)
                    .map(([sbName, sbData]) => {
                        const words = splitByCapital(sbName);
                        const suffix = `${words.at(-2)}${words.at(-1)}`;

                        // delta placeholders
                        let timeDelta = "";
                        let tokensDelta = "";
                        let bombsDelta = "";

                        // if this is a recycled prime, compute deltas
                        if (
                            showDelta &&
                            sbName.at(0) === "L" &&
                            sbName.includes(":recycle:")
                        ) {
                            const baseKey = sbName.replace(
                                /\s*:recycle:\d+\s*/,
                                " ",
                            );
                            const base = transformedData[baseKey];

                            if (base) {
                                const td = sbData.time - base.time;
                                timeDelta =
                                    td >= 0
                                        ? ` (+${SecondsToString(td)})`
                                        : ` (-${SecondsToString(
                                              Math.abs(td),
                                          )})`;

                                const tD = sbData.tokens - base.tokens;
                                tokensDelta = tD >= 0 ? `(+${tD})` : `(${tD})`;

                                const bD = sbData.bombs - base.bombs;
                                bombsDelta = bD >= 0 ? `(+${bD})` : `(${bD})`;
                            }
                        }

                        return (
                            `   - Prime ${suffix} :hourglass: ${SecondsToString(
                                sbData.time,
                            )}${timeDelta} ` +
                            `- :tickets: ${sbData.tokens} ${tokensDelta} ` +
                            `:boom: ${sbData.bombs} ${bombsDelta}`
                        );
                    });

                const extra = sidebosses.length
                    ? "\n" + sidebosses.join("\n")
                    : "";

                let mainTimeDelta = "";
                let mainTokensDelta = "";
                let mainBombsDelta = "";
                if (
                    showDelta &&
                    boss.at(0) === "L" &&
                    boss.includes(":recycle:")
                ) {
                    const baseKey = boss.replace(/\s*:recycle:\d+\s*/, " ");
                    const base = transformedData[baseKey];
                    if (base) {
                        const td = data.time - base.time;
                        mainTimeDelta =
                            td >= 0
                                ? ` (+${SecondsToString(td)})`
                                : ` (-${SecondsToString(Math.abs(td))})`;
                        const tD = data.tokens - base.tokens;
                        mainTokensDelta = tD >= 0 ? `(+${tD})` : `(${tD})`;
                        const bD = data.bombs - base.bombs;
                        mainBombsDelta = bD >= 0 ? `(+${bD})` : `(${bD})`;
                    }
                }

                value =
                    `- Boss: :hourglass: ${SecondsToString(
                        data.time,
                    )} ${mainTimeDelta}` +
                    `- :tickets: ${data.tokens} ${mainTokensDelta}` +
                    `:boom: ${data.bombs} ${mainBombsDelta}${extra}`;
            } else {
                // Regular listing
                let timeDelta = "";
                let tokensDelta = "";
                let bombsDelta = "";
                if (
                    showDelta &&
                    boss.at(0) === "L" &&
                    boss.includes(":recycle:")
                ) {
                    const baseline =
                        transformedData[
                            boss.replace(/\s*:recycle:\d+\s*/, " ")
                        ];

                    if (baseline) {
                        const timeD = data.time - baseline.time;
                        timeDelta =
                            timeD >= 0
                                ? `(+${SecondsToString(timeD)})`
                                : `(-${SecondsToString(Math.abs(timeD))})`;
                        const tokenD = data.tokens - baseline.tokens;
                        tokensDelta =
                            tokenD >= 0 ? `(+${tokenD})` : `(${tokenD})`;
                        const bombD = data.bombs - baseline.bombs;
                        bombsDelta = bombD >= 0 ? `(+${bombD})` : `(${bombD})`;
                    }
                }
                value = `:hourglass: ${SecondsToString(
                    data.time,
                )} ${timeDelta} - :tickets: ${
                    data.tokens
                } ${tokensDelta} :boom: ${data.bombs} ${bombsDelta}`;
            }

            pagination.addFields({ name: boss, value });
        }

        pagination.setFooter({
            text: "Gleam code: LOVRAFFLE\nReferral code: HUG-44-CAN if you want to support me",
        });
        pagination.paginateFields(true);
        pagination.render();

        logger.info(
            `${interaction.user.username} successfully executed /gr-time-used ${season} ${rarity}`,
        );
    } catch (error) {
        logger.error(
            error,
            `Error while executing /gr-time-used command for user ${discordID}`,
        );
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
