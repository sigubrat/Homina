import type { GuildRaidResult } from "@/models/types";
import type { TokensUsed } from "@/models/types/TokensUsed";

// Nb! Relies on the user providing sorted data

/**
 * Returns a formatted list of the top N damage dealers from a sorted array of guild raid results.
 * Each entry includes a medal emoji (🥇 for first, 🥈 for second, 🥉 for third), the player's username, and their total damage formatted with thousands separators.
 *
 * @param sortedData - An array of `GuildRaidResult` objects, sorted in descending order by total damage.
 * @param n - The number of top damage dealers to include in the result.
 * @returns An array of strings, each representing a top damage dealer with their medal, username, and formatted damage.
 */
export function getTopNDamageDealers(sortedData: GuildRaidResult[], n: number) {
    return sortedData.slice(0, n).map((player, index) => {
        const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
        const formattedDamage = player.totalDamage.toLocaleString();
        return `${medal} ${player.username}: ${formattedDamage}`;
    });
}

/**
 * Sorts an array of `GuildRaidResult` objects in descending order based on their `totalDamage` property.
 *
 * @param data - The array of `GuildRaidResult` objects to sort.
 * @returns The sorted array with highest `totalDamage` first.
 */
export function sortGuildRaidResultDesc(data: GuildRaidResult[]) {
    return data.sort((a, b) => b.totalDamage - a.totalDamage);
}

/**
 * Sorts an array of `TokensUsed` objects in descending order based on the `tokens` property.
 *
 * @param data - The array of `TokensUsed` objects to be sorted.
 * @returns The sorted array with objects ordered from highest to lowest `tokens` value.
 */
export function sortTokensUsed(data: TokensUsed[]) {
    return data.sort((a, b) => b.tokens - a.tokens);
}

/**
 * Checks if a given string is a valid UUID version 4.
 *
 * A valid UUID v4 has the format: xxxxxxxx-xxxx-4xxx-[8|9|a|b]xxx-xxxxxxxxxxxx,
 * where each 'x' is a hexadecimal digit.
 *
 * @param uuid - The string to validate as a UUID v4.
 * @returns `true` if the string is a valid UUID v4, otherwise `false`.
 */
export function isValidUUIDv4(uuid: string): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Calculates the standard deviation of an array of numbers.
 *
 * The standard deviation is a measure of the amount of variation or dispersion in a set of values.
 * Returns 0 if the input array is empty.
 *
 * @param arr - The array of numbers to calculate the standard deviation for.
 * @returns The standard deviation of the input array.
 */
export function standardDeviation(arr: number[]): number {
    if (arr.length === 0) return 0;

    const mean = numericAverage(arr);
    const squaredDiffs = arr.map((value) => Math.pow(value - mean, 2));
    const variance = numericAverage(squaredDiffs);
    return Math.sqrt(variance);
}

/**
 * Calculates the average (arithmetic mean) of an array of numbers.
 *
 * @param arr - The array of numbers to average.
 * @returns The average value of the numbers in the array. Returns `0` if the array is empty.
 */
export function numericAverage(arr: number[]): number {
    if (arr.length === 0) return 0;

    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
}

/**
 * Calculates the median value of a numeric array.
 *
 * The median is the middle number in a sorted, ascending or descending, list of numbers.
 * If the array has an even number of elements, the median is the average of the two middle numbers.
 * Returns `0` if the input array is empty.
 *
 * @param arr - The array of numbers to find the median of.
 * @returns The median value of the array, or `0` if the array is empty.
 */
export function numericMedian(arr: number[]): number {
    if (arr.length === 0) return 0;

    const sorted = [...arr].sort((a, b) => a - b);
    const middleIndex = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        return (sorted[middleIndex - 1]! + sorted[middleIndex]!) / 2;
    } else {
        return sorted[middleIndex]!;
    }
}

/**
 * Formats an absolute percentage (where 100% = average) as a signed delta string.
 * For example, 102.3 becomes "+2.3%" and 95.0 becomes "-5.0%".
 *
 * @param value - The absolute percentage value (100 = guild average).
 * @returns A formatted string with a sign prefix and one decimal place.
 */
export function formatDelta(value: number): string {
    const delta = value - 100;
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}%`;
}
