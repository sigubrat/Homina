import type { GuildRaidResult } from "@/models/types";
import type { TimeUsed } from "@/models/types/TimeUsed";
import { logger } from "../HominaLogger";
import { timestampInSecondsToString } from "../utils";

export class DataTransformationService {
    constructor() {}

    async timeUsedPerBoss(
        seasonData: GuildRaidResult[]
    ): Promise<Record<string, TimeUsed>> {
        const groupedData = seasonData.reduce(
            (acc: Record<string, GuildRaidResult[]>, curr: GuildRaidResult) => {
                const key = `${curr.boss}-${curr.tier}`;
                if (!acc[key]) {
                    acc[key] = [];
                }
                acc[key].push(curr);
                return acc;
            },
            {} as Record<string, GuildRaidResult[]> // initial accumulator value
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
            console.log(`Processing boss: ${boss}`);
            // If this is the first boss, we take the first entry for that boss and the last and calculate the time
            if (previousKey === null) {
                console.log(`First boss: ${boss}`);
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

            console.log(`Not first boss: ${boss}`);
            const lastEntry = data[data.length - 1];
            if (!lastEntry) {
                logger.error(
                    `Last entry not found for boss ${boss} while calculating time used`
                );
                continue;
            }
            if (!groupedData[previousKey]) {
                logger.error(
                    `Previous key ${previousKey} not found in groupedData while calculating time used`
                );
                continue;
            }
            if (
                groupedData[previousKey][
                    groupedData[previousKey].length - 1
                ] === undefined
            ) {
                logger.error(
                    `Previous last entry not found for boss ${previousKey} while calculating time used`
                );
                continue;
            }
            const previousLast =
                groupedData[previousKey][groupedData[previousKey].length - 1];
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

            result[boss] = {
                time: timeUsed,
                tokens: data.length,
            };

            previousKey = boss;
        }

        return result;
    }
}
