import type { TokenStatus } from "@/models/types";
import {
    MINIMUM_SEASON_THRESHOLD,
    SEASON_85_SEASON_START,
} from "../configs/constants";

export function getUnixTimestamp(date: Date) {
    return Math.floor(date.getTime() / 1000);
}
/**
 * Evaluates and updates the token status based on the elapsed time since the last refresh.
 *
 * Tokens recharge every 12 hours, up to a maximum of 3 tokens.
 * If enough time has passed to fully recharge, the token count is set to the maximum and the refresh time is updated.
 * Otherwise, the token count is incremented by the number of recharge intervals that have passed,
 * and the refresh time is advanced accordingly.
 *
 * @param token - The current token status, including count and last refresh time.
 * @param timestampInSeconds - The current timestamp in seconds.
 * @returns The updated token status after evaluation.
 */
export function evaluateToken(
    token: TokenStatus,
    timestampInSeconds: number,
): TokenStatus {
    const twelveHoursInSeconds = 12 * 60 * 60;
    const maxTokens = 3;
    const nRecharged = Math.floor(
        (timestampInSeconds - token.refreshTime) / twelveHoursInSeconds,
    );

    if (nRecharged + token.count >= maxTokens) {
        token.count = maxTokens;
        token.refreshTime = timestampInSeconds;
    } else {
        token.count += nRecharged;
        token.refreshTime += nRecharged * twelveHoursInSeconds;
    }

    return token;
}
/**
 * Converts a timestamp in seconds to a human-readable string format.
 *
 * The output format is either "Xd HHh MMm SSs" (if `hideDays` is false and days are present)
 * or "HHh MMm SSs" (if `hideDays` is true or days are zero).
 *
 * @param timestampInSeconds - The time duration in seconds to convert.
 * @param hideDays - If true, days are not shown and hours may exceed 24.
 * @returns A formatted string representing the duration.
 *
 * @example
 * SecondsToString(90061) // "1d 01h 01m 01s"
 * SecondsToString(90061, true) // "25h 01m 01s"
 */
export function SecondsToString(
    timestampInSeconds: number,
    hideDays: boolean = false,
): string {
    const secondsPerDay = 24 * 3600;
    const days = Math.floor(timestampInSeconds / secondsPerDay);
    const remAfterDays = timestampInSeconds % secondsPerDay;

    let hours: number | string;
    let minutes: string;
    let seconds: string;
    let daysPart = "";

    if (hideDays) {
        // All hours, no days part
        hours = Math.floor(timestampInSeconds / 3600)
            .toString()
            .padStart(2, "0");
        const remAfterHours = timestampInSeconds % 3600;
        minutes = Math.floor(remAfterHours / 60)
            .toString()
            .padStart(2, "0");
        seconds = (remAfterHours % 60).toString().padStart(2, "0");
    } else {
        hours = Math.floor(remAfterDays / 3600)
            .toString()
            .padStart(2, "0");
        const remAfterHours = remAfterDays % 3600;
        minutes = Math.floor(remAfterHours / 60)
            .toString()
            .padStart(2, "0");
        seconds = (remAfterHours % 60).toString().padStart(2, "0");
        daysPart = days > 0 ? `${days}d ` : "";
    }

    return `${daysPart}${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Checks if the cooldown is within the next hour.
 * @param cooldown The cooldown string in a specific bot-related format (xxHyyM) (e.g., "01h30m").
 * @returns True if the cooldown is within the next hour, false otherwise.
 */
export function withinNextHour(cooldown: string): boolean {
    cooldown.slice(1);

    const num = Number(cooldown.slice(0, 2));

    return num < 1;
}

/**
 * Calculates the current season number based on the provided date.
 *
 * The calculation assumes each season lasts for 14 days, starting from a predefined
 * start date (`SEASON_85_SEASON_START`). The returned season number is offset by 85.
 *
 * @param currentDate - The date for which to calculate the current season.
 * @returns The current season number as a number.
 */
export function calculateCurrentSeason(currentDate: Date): number {
    const daysPerSeason = 14;
    const startDate = SEASON_85_SEASON_START;
    const diffInTime = currentDate.getTime() - startDate.getTime();
    const diffInDays = Math.floor(diffInTime / (1000 * 3600 * 24));
    return Math.floor(diffInDays / daysPerSeason) + 85;
}

/**
 * Determines whether a given season value is invalid.
 *
 * A season is considered invalid if:
 * - It is `null`
 * - It is not an integer
 * - It is less than the minimum season threshold (`MINIMUM_SEASON_THRESHOLD`)
 * - It is greater than the current season (as calculated by `calculateCurrentSeason`)
 *
 * @param season - The season value to validate.
 * @returns `true` if the season is invalid, otherwise `false`.
 */
export function isInvalidSeason(season: number | null): boolean {
    return (
        season === null ||
        !Number.isInteger(season) ||
        season < MINIMUM_SEASON_THRESHOLD ||
        season > calculateCurrentSeason(new Date())
    );
}

/**
 * Extracts the first time value found in a string and converts it to total minutes.
 *
 * Supported formats are `HH:MM` and `HHhMMm` (with optional `+` or `-` prefix for
 * the `h/m` variant). This is intended for sorting cooldown text where the time may
 * be embedded in a longer status string.
 *
 * If no valid time segment is found, a large fallback value is returned so invalid
 * values naturally sort to the end in ascending order.
 *
 * @param s - Input text that may contain a supported time format.
 * @returns Total minutes represented by the first matched time value, or Number.MAX_SAFE_INTEGER when no match is found.
 *
 * @example
 * toMinutes("02:30") // 150
 * toMinutes("cooldown 05h15m") // 315
 */
export function toMinutes(s: string): number {
    const colonMatch = s.match(/(\d{1,3}):(\d{2})/);
    if (colonMatch) return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);

    const hmMatch = s.match(/[+-]?(\d{1,4})h(\d{2})m/i);
    if (hmMatch) return Number(hmMatch[1]) * 60 + Number(hmMatch[2]);

    return Number.MAX_SAFE_INTEGER;
}
