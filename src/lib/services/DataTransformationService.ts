import type { Raid } from "@/models/types";
import type { TimeUsed } from "@/models/types/TimeUsed";
import { logger } from "../HominaLogger";
import {
    getMetaTeam,
    mapTierToRarity,
    SecondsToString,
    splitByCapital,
} from "../utils";
import { DamageType, EncounterType } from "@/models/enums";
import type { Highscore } from "@/models/types/Highscore";

export class DataTransformationService {
    constructor() {}

    async timeUsedPerBoss(
        seasonData: Raid[],
        separatePrimes: boolean = false
    ): Promise<[Record<string, TimeUsed>, string]> {
        const groupedData = seasonData.reduce(
            (acc: Record<string, Raid[]>, curr: Raid) => {
                let key: string;
                if (
                    separatePrimes &&
                    curr.encounterType === EncounterType.SIDE_BOSS
                ) {
                    const unitWords = curr.unitId.split(/(?=[A-Z])/);
                    const unit = `${unitWords.at(-2)}${unitWords.at(-1)}`;
                    if (!unit) {
                        logger.error(
                            `Unit ID ${curr.unitId} is invalid or empty while calculating time used`
                        );
                        return acc;
                    }
                    key = `${mapTierToRarity(curr.tier, curr.set + 1)} ${unit}`;
                    if (unit === "NecroMenhir") {
                        key += `-${curr.encounterIndex}`;
                    }
                } else {
                    key = `${mapTierToRarity(curr.tier, curr.set + 1)} ${
                        curr.type
                    }`;
                }
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key]!.push(curr);
                return acc;
            },
            {} as Record<string, Raid[]> // initial accumulator value
        );

        const result: Record<string, TimeUsed> = {};
        let previousKey: null | string = null;
        for (const boss in groupedData) {
            const data = groupedData[boss];
            if (!data) {
                logger.error(
                    `Key ${boss} not found in groupedData while calculating time used`
                );
                continue;
            }

            const totalTokens = data.filter(
                (raid) => raid.damageType === DamageType.BATTLE
            ).length;

            const totalBombs = data.length - totalTokens;

            // If this is the first boss, we take the first entry for that boss and the last and calculate the time
            if (previousKey === null) {
                const firstEntry = data[0];
                const lastEntry = data[data.length - 1];
                if (!firstEntry || !lastEntry) {
                    logger.error(
                        `First or last entry not found for boss ${boss}`
                    );
                    continue;
                }
                const isPrime =
                    firstEntry.encounterType === EncounterType.SIDE_BOSS;

                const timeInSeconds = Math.abs(
                    firstEntry?.startedOn - lastEntry?.startedOn
                );

                result[boss] = {
                    time: timeInSeconds,
                    tokens: totalTokens,
                    bombs: totalBombs,
                    sideboss: [
                        isPrime,
                        `${mapTierToRarity(
                            firstEntry.tier,
                            firstEntry.set + 1
                        )} ${lastEntry.type}`,
                    ],
                };
                previousKey = boss;
                continue;
            }

            const lastEntry = data[data.length - 1];
            if (!lastEntry) {
                logger.error(
                    `Last entry not found for boss ${boss} while calculating time used`
                );
                continue;
            }

            const previousData = groupedData[previousKey];
            if (!previousData) {
                logger.error(
                    `Previous data not found for boss ${previousKey} while calculating time used`
                );
                continue;
            }

            const previousLast = previousData[previousData.length - 1];
            if (!previousLast) {
                logger.error(
                    `Previous last entry not found for boss ${previousKey}`
                );
                continue;
            }
            if (
                lastEntry.startedOn === undefined ||
                previousLast.startedOn === undefined
            ) {
                logger.error(
                    `StartedOn timestamp not found for boss ${boss} or previous boss ${previousKey}`
                );
                continue;
            }

            const timeInSeconds = Math.abs(
                previousLast.startedOn - lastEntry.startedOn
            );

            const timeUsed = timeInSeconds;

            const isPrime = lastEntry.encounterType === EncounterType.SIDE_BOSS;

            result[boss] = {
                time: timeUsed,
                tokens: totalTokens,
                bombs: totalBombs,
                sideboss: [
                    isPrime,
                    `${mapTierToRarity(lastEntry.tier, lastEntry.set + 1)} ${
                        lastEntry.type
                    }`,
                ],
            };

            previousKey = boss;
        }

        const allTimes = seasonData.map((raid) => raid.startedOn);
        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);
        const totalTime = maxTime - minTime;
        const totalTimeUsed = SecondsToString(totalTime);

        return [result, totalTimeUsed];
    }

    async seasonHighscores(seasonData: Raid[]) {
        const result: Record<string, Highscore[]> = {};

        for (const raid of seasonData) {
            const unitWords = raid.unitId.split(/(?=[A-Z])/);
            const unit = `${unitWords.at(-3)?.toLowerCase()}${unitWords.at(
                -2
            )}${unitWords.at(-1)}`;
            const key = `${mapTierToRarity(
                raid.tier,
                raid.set + 1,
                false
            )} ${unit}`;

            if (!result[key]) {
                result[key] = [];
            }

            const existingEntry = result[key].find(
                (entry) => entry.username === raid.userId
            );

            const team = raid.heroDetails.map((hero) => hero.unitId);
            const metaTeam = getMetaTeam(team);

            if (!existingEntry) {
                result[key].push({
                    username: raid.userId,
                    value: raid.damageDealt,
                    team: metaTeam,
                });
            } else {
                if (raid.damageDealt > existingEntry.value) {
                    existingEntry.value = raid.damageDealt;
                    existingEntry.team = metaTeam;
                }
            }
        }

        // Sort each highscore array by value in descending order
        for (const key in result) {
            result[key]?.sort((a, b) => b.value - a.value);
        }

        return result;
    }

    async highestDmgComps(seasonData: Raid[]) {
        const maxPerBoss: Record<string, Raid> = {};

        for (const raid of seasonData) {
            const key =
                splitByCapital(raid.unitId).at(-2)! +
                splitByCapital(raid.unitId).at(-1)!;
            if (
                !maxPerBoss[key] ||
                raid.damageDealt > maxPerBoss[key].damageDealt
            ) {
                maxPerBoss[key] = raid;
            }
        }

        return maxPerBoss;
    }
}
