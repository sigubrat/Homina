import type { Raid } from "@/models/types";
import type { TimeUsed } from "@/models/types/TimeUsed";
import { logger } from "../HominaLogger";
import { mapTierToRarity, timestampInSecondsToString } from "../utils";

export class DataTransformationService {
    constructor() {}

    async timeUsedPerBoss(
        seasonData: Raid[]
    ): Promise<Record<string, TimeUsed>> {
        const groupedData = seasonData.reduce(
            (acc: Record<string, Raid[]>, curr: Raid) => {
                if (curr.damageType === "Bomb") {
                    return acc;
                }
                const key = `${curr.type}-${mapTierToRarity(curr.tier)}-${
                    curr.set
                }`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(curr);
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
                const timeInSeconds = Math.abs(
                    firstEntry?.startedOn - lastEntry?.startedOn
                );

                result[boss] = {
                    time: timestampInSecondsToString(timeInSeconds),
                    tokens: data.length,
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

            const timeUsed = timestampInSecondsToString(timeInSeconds);

            result[boss] = {
                time: timeUsed,
                tokens: data.length,
            };

            previousKey = boss;
        }

        return result;
    }
}
