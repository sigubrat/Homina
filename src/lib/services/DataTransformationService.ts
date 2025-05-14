import type { GuildRaidResult } from "@/models/types";
import type { TimeUsed } from "@/models/types/TimeUsed";
import { logger } from "../HominaLogger";
import { timestampInSecondsToString } from "../utils";

export class GuildService {
    constructor() {}

    async timeUsedPerBoss(seasonData: GuildRaidResult[]) {
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
        let previous: null | string = null;
        for (const boss in groupedData) {
            const data = groupedData[boss];
            if (!data) {
                logger.error(
                    `Key ${boss} not found in groupedData while calculating time used`
                );
                continue;
            }
            // If this is the first boss, we take the first entry for that boss and the last and calculate the time
            if (previous === null) {
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
            }
        }
    }
}
