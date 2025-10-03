import type { TokenStatus } from "@/models/types";

export function getUnixTimestamp(date: Date) {
    return Math.floor(date.getTime() / 1000);
}
export function evaluateToken(
    token: TokenStatus,
    timestampInSeconds: number
): TokenStatus {
    const twelveHoursInSeconds = 12 * 60 * 60;
    const maxTokens = 3;
    const nRecharged = Math.floor(
        (timestampInSeconds - token.refreshTime) / twelveHoursInSeconds
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
export function SecondsToString(
    timestampInSeconds: number,
    hideDays: boolean = false
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
