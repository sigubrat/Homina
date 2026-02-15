/**
 * Creates a tracker for assigning consistent labels to unknown users.
 * Each unique userId gets a consistent "Unknown #N" label.
 *
 * @returns An object with methods to get labels for unknown users.
 *
 * @example
 * ```typescript
 * const unknownTracker = createUnknownUserTracker();
 * const label1 = unknownTracker.getLabel("user-id-1"); // "Unknown #1"
 * const label2 = unknownTracker.getLabel("user-id-2"); // "Unknown #2"
 * const label3 = unknownTracker.getLabel("user-id-1"); // "Unknown #1" (same as before)
 * ```
 */
export function createUnknownUserTracker() {
    const unknownUserMap = new Map<string, string>();
    let counter = 1;

    return {
        /**
         * Gets a consistent label for an unknown user.
         * If the userId has been seen before, returns the same label.
         * Otherwise, assigns a new "Unknown #N" label.
         *
         * @param userId - The unique identifier of the unknown user.
         * @returns A consistent "Unknown #N" label for this user.
         */
        getLabel(userId: string): string {
            if (!unknownUserMap.has(userId)) {
                unknownUserMap.set(userId, `Unknown #${counter++}`);
            }
            return unknownUserMap.get(userId)!;
        },

        /**
         * Returns the current count of unique unknown users tracked.
         */
        getCount(): number {
            return unknownUserMap.size;
        },
    };
}

/**
 * Formats an unknown user label with a given counter value.
 * Use this for simple cases where you don't need to track consistency.
 *
 * @param counter - The counter value to use in the label.
 * @returns A formatted "Unknown #N" label.
 */
export function formatUnknownUser(counter: number): string {
    return `Unknown #${counter}`;
}

/**
 * Replaces userId keys in a record with display names, using "Unknown #N" for
 * users not found in the players list.
 *
 * @param record - The record with userId keys to transform.
 * @param players - Array of players with userId and displayName properties.
 * @returns A new record with display names as keys.
 *
 * @example
 * ```typescript
 * const record = { "user-1": { score: 100 }, "user-2": { score: 200 } };
 * const players = [{ userId: "user-1", displayName: "Alice" }];
 * const result = replaceUserIdKeysWithDisplayNames(record, players);
 * // { "Alice": { score: 100 }, "Unknown #1": { score: 200 } }
 * ```
 */
export function replaceUserIdKeysWithDisplayNames<T>(
    record: Record<string, T>,
    players: { userId: string; displayName: string }[],
): Record<string, T> {
    const unknownTracker = createUnknownUserTracker();
    const result: Record<string, T> = {};

    for (const userId of Object.keys(record)) {
        const player = players.find((p) => p.userId === userId);
        const key = player
            ? player.displayName
            : unknownTracker.getLabel(userId);
        result[key] = record[userId]!;
    }

    return result;
}

/**
 * Replaces userId values in an array of objects with display names,
 * using "Unknown #N" for users not found in the players list.
 *
 * @param items - Array of objects containing a userId field.
 * @param userIdField - The field name containing the userId to replace.
 * @param players - Array of players with userId and displayName properties.
 * @returns A new array with display names in place of userIds.
 *
 * @example
 * ```typescript
 * const items = [{ username: "user-1", score: 100 }];
 * const players = [{ userId: "user-1", displayName: "Alice" }];
 * const result = replaceUserIdFieldWithDisplayNames(items, "username", players);
 * // [{ username: "Alice", score: 100 }]
 * ```
 */
export function replaceUserIdFieldWithDisplayNames<T, K extends keyof T>(
    items: T[],
    userIdField: K,
    players: { userId: string; displayName: string }[],
): T[] {
    const unknownTracker = createUnknownUserTracker();

    return items.map((item) => {
        const userId = item[userIdField] as string;
        const player = players.find((p) => p.userId === userId);
        const displayName = player
            ? player.displayName
            : unknownTracker.getLabel(userId);
        return { ...item, [userIdField]: displayName };
    });
}
