import {
    createUnknownUserTracker,
    formatUnknownUser,
    replaceUserIdKeysWithDisplayNames,
    replaceUserIdFieldWithDisplayNames,
} from "@/lib/utils/userUtils";
import { describe, expect, test } from "bun:test";

describe("userUtils - createUnknownUserTracker", () => {
    test("should return consistent labels for the same userId", () => {
        const tracker = createUnknownUserTracker();
        const label1 = tracker.getLabel("user-1");
        const label2 = tracker.getLabel("user-1");
        expect(label1).toBe("Unknown #1");
        expect(label2).toBe("Unknown #1");
    });

    test("should assign incrementing labels for different userIds", () => {
        const tracker = createUnknownUserTracker();
        const label1 = tracker.getLabel("user-1");
        const label2 = tracker.getLabel("user-2");
        const label3 = tracker.getLabel("user-3");
        expect(label1).toBe("Unknown #1");
        expect(label2).toBe("Unknown #2");
        expect(label3).toBe("Unknown #3");
    });

    test("should track count of unique unknown users", () => {
        const tracker = createUnknownUserTracker();
        expect(tracker.getCount()).toBe(0);
        tracker.getLabel("user-1");
        expect(tracker.getCount()).toBe(1);
        tracker.getLabel("user-2");
        expect(tracker.getCount()).toBe(2);
        tracker.getLabel("user-1"); // Same user, should not increase count
        expect(tracker.getCount()).toBe(2);
    });

    test("should create independent trackers", () => {
        const tracker1 = createUnknownUserTracker();
        const tracker2 = createUnknownUserTracker();
        tracker1.getLabel("user-1");
        tracker1.getLabel("user-2");
        expect(tracker2.getLabel("user-3")).toBe("Unknown #1");
    });
});

describe("userUtils - formatUnknownUser", () => {
    test("should format with correct pattern", () => {
        expect(formatUnknownUser(1)).toBe("Unknown #1");
        expect(formatUnknownUser(42)).toBe("Unknown #42");
        expect(formatUnknownUser(100)).toBe("Unknown #100");
    });
});

describe("userUtils - replaceUserIdKeysWithDisplayNames", () => {
    const players = [
        { userId: "user-1", displayName: "Alice" },
        { userId: "user-2", displayName: "Bob" },
    ];

    test("should replace known userId keys with display names", () => {
        const record = {
            "user-1": { score: 100 },
            "user-2": { score: 200 },
        };
        const result = replaceUserIdKeysWithDisplayNames(record, players);
        expect(result).toEqual({
            Alice: { score: 100 },
            Bob: { score: 200 },
        });
    });

    test("should replace unknown userId keys with Unknown #N", () => {
        const record = {
            "user-1": { score: 100 },
            "unknown-user": { score: 200 },
        };
        const result = replaceUserIdKeysWithDisplayNames(record, players);
        expect(result).toEqual({
            Alice: { score: 100 },
            "Unknown #1": { score: 200 },
        });
    });

    test("should handle multiple unknown users with consistent numbering", () => {
        const record = {
            "unknown-1": { score: 100 },
            "unknown-2": { score: 200 },
            "unknown-3": { score: 300 },
        };
        const result = replaceUserIdKeysWithDisplayNames(record, players);
        expect(result).toEqual({
            "Unknown #1": { score: 100 },
            "Unknown #2": { score: 200 },
            "Unknown #3": { score: 300 },
        });
    });

    test("should handle empty record", () => {
        const record = {};
        const result = replaceUserIdKeysWithDisplayNames(record, players);
        expect(result).toEqual({});
    });

    test("should handle empty players list", () => {
        const record = { "user-1": { score: 100 } };
        const result = replaceUserIdKeysWithDisplayNames(record, []);
        expect(result).toEqual({ "Unknown #1": { score: 100 } });
    });

    test("should preserve original values", () => {
        const record = {
            "user-1": { score: 100, nested: { value: "test" } },
        };
        const result = replaceUserIdKeysWithDisplayNames(record, players);
        expect(result.Alice).toEqual({ score: 100, nested: { value: "test" } });
    });
});

describe("userUtils - replaceUserIdFieldWithDisplayNames", () => {
    const players = [
        { userId: "user-1", displayName: "Alice" },
        { userId: "user-2", displayName: "Bob" },
    ];

    test("should replace known userId field values with display names", () => {
        const items = [
            { username: "user-1", score: 100 },
            { username: "user-2", score: 200 },
        ];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "username",
            players,
        );
        expect(result).toEqual([
            { username: "Alice", score: 100 },
            { username: "Bob", score: 200 },
        ]);
    });

    test("should replace unknown userId field values with Unknown #N", () => {
        const items = [
            { username: "user-1", score: 100 },
            { username: "unknown-user", score: 200 },
        ];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "username",
            players,
        );
        expect(result).toEqual([
            { username: "Alice", score: 100 },
            { username: "Unknown #1", score: 200 },
        ]);
    });

    test("should handle multiple unknown users with consistent numbering", () => {
        const items = [
            { userId: "unknown-1", data: "a" },
            { userId: "unknown-2", data: "b" },
            { userId: "unknown-1", data: "c" }, // Same unknown user
        ];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "userId",
            players,
        );
        expect(result).toEqual([
            { userId: "Unknown #1", data: "a" },
            { userId: "Unknown #2", data: "b" },
            { userId: "Unknown #1", data: "c" }, // Should have same label
        ]);
    });

    test("should handle empty array", () => {
        const items: { username: string }[] = [];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "username",
            players,
        );
        expect(result).toEqual([]);
    });

    test("should handle empty players list", () => {
        const items = [{ username: "user-1", score: 100 }];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "username",
            [],
        );
        expect(result).toEqual([{ username: "Unknown #1", score: 100 }]);
    });

    test("should preserve other fields", () => {
        const items = [
            {
                username: "user-1",
                score: 100,
                nested: { value: "test" },
                active: true,
            },
        ];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "username",
            players,
        );
        expect(result[0]).toEqual({
            username: "Alice",
            score: 100,
            nested: { value: "test" },
            active: true,
        });
    });

    test("should work with different field names", () => {
        const items = [{ oddsPlayerId: "user-1", value: 42 }];
        const result = replaceUserIdFieldWithDisplayNames(
            items,
            "oddsPlayerId",
            players,
        );
        expect(result).toEqual([{ oddsPlayerId: "Alice", value: 42 }]);
    });
});
