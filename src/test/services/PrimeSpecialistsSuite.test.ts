import { describe, expect, mock, test } from "bun:test";
import { createMockClient } from "../mocks/mockTacticusClient";
import { createMockDb } from "../mocks/mockDbController";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import type { Raid } from "@/models/types";
import type { MiddlewareMember } from "@/models/types";
import { NotRegisteredError } from "@/models/errors/UserError";

const mockMembers: MiddlewareMember[] = [
    { userId: "player-a", displayName: "Alice", role: "member" },
    { userId: "player-b", displayName: "Bob", role: "member" },
    { userId: "player-c", displayName: "Charlie", role: "member" },
    { userId: "player-d", displayName: "Diana", role: "member" },
];

let mockFetchGuildMembersResult: MiddlewareMember[] | null = mockMembers;

// Mock the middleware so resolveGuildMembers doesn't make HTTP calls
mock.module("@/client/MiddlewareClient", () => ({
    fetchGuildMembers: async () => {
        if (mockFetchGuildMembersResult === null) {
            throw new Error("Simulated fetch failure");
        }
        return mockFetchGuildMembersResult;
    },
}));

// Import after mocking
const { RaidAnalyticsService } =
    await import("@/lib/services/RaidAnalyticsService");

function makeRaid(overrides: Partial<Raid> = {}): Raid {
    return {
        userId: "player-a",
        tier: 4,
        set: 0,
        encounterIndex: 0,
        remainingHp: 200000,
        maxHp: 300000,
        encounterType: EncounterType.SIDE_BOSS,
        unitId: "prime_unit_ragnar",
        type: "TestBoss",
        rarity: Rarity.LEGENDARY,
        damageDealt: 100000,
        damageType: DamageType.BATTLE,
        startedOn: 1000,
        completedOn: 1100,
        heroDetails: [],
        machineOfWarDetails: null,
        globalConfigHash: "hash",
        ...overrides,
    };
}

describe("RaidAnalyticsServiceSuite - getPrimeSpecialists", () => {
    test("should throw NotRegisteredError when no API key is found", async () => {
        const mockDb = createMockDb({
            getUserToken: async () => null,
        });
        const service = new RaidAnalyticsService(createMockClient(), mockDb);
        await expect(
            service.getPrimeSpecialists("user-1", Rarity.LEGENDARY),
        ).rejects.toBeInstanceOf(NotRegisteredError);
    });

    test("should throw when guild members cannot be fetched", async () => {
        mockFetchGuildMembersResult = null;
        try {
            const mockDb = createMockDb({
                getGuildIdByUserId: async () => "guild-1",
                getAllPlayerMetadataByGuild: async () => [],
            });
            const service = new RaidAnalyticsService(
                createMockClient(),
                mockDb,
            );
            await expect(
                service.getPrimeSpecialists("user-1", Rarity.LEGENDARY),
            ).rejects.toThrow();
        } finally {
            mockFetchGuildMembersResult = mockMembers;
        }
    });

    test("should return null when no current season is found and no season specified", async () => {
        const mockClient = createMockClient({
            getGuildRaidByCurrentSeason: async () => ({
                season: 0,
                seasonConfigId: "",
                entries: [],
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
        );
        expect(result).toBeNull();
    });

    test("should return null when no prime entries exist in the target season", async () => {
        const entries: Raid[] = [
            makeRaid({
                encounterType: EncounterType.BOSS,
                unitId: "boss1",
                type: "MainBoss",
            }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries,
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );
        expect(result).toBeNull();
    });

    test("should return top players ranked by avg damage per token", async () => {
        // player-a: 3 hits averaging 150k
        // player-b: 3 hits averaging 100k
        // player-c: 2 hits averaging 200k (should be #1)
        const entries: Raid[] = [
            makeRaid({ userId: "player-a", damageDealt: 150000 }),
            makeRaid({ userId: "player-a", damageDealt: 150000 }),
            makeRaid({ userId: "player-a", damageDealt: 150000 }),
            makeRaid({ userId: "player-b", damageDealt: 100000 }),
            makeRaid({ userId: "player-b", damageDealt: 100000 }),
            makeRaid({ userId: "player-b", damageDealt: 100000 }),
            makeRaid({ userId: "player-c", damageDealt: 200000 }),
            makeRaid({ userId: "player-c", damageDealt: 200000 }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: entries.map((e) => ({ ...e })),
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const primeKeys = Object.keys(result!.primes);
        expect(primeKeys.length).toBe(1);

        const ranked = Object.values(result!.primes)[0]!;
        expect(ranked.length).toBe(3);
        expect(ranked[0]!.player).toBe("Charlie"); // 200k avg
        expect(ranked[0]!.avgDmg).toBe(200000);
        expect(ranked[1]!.player).toBe("Alice"); // 150k avg
        expect(ranked[1]!.avgDmg).toBe(150000);
        expect(ranked[2]!.player).toBe("Bob"); // 100k avg
        expect(ranked[2]!.avgDmg).toBe(100000);
    });

    test("should only include players with at least 2 tokens", async () => {
        const entries: Raid[] = [
            makeRaid({ userId: "player-a", damageDealt: 150000 }),
            makeRaid({ userId: "player-a", damageDealt: 150000 }),
            makeRaid({ userId: "player-b", damageDealt: 999999 }), // only 1 token - excluded
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async (_apiKey: string, season: number) => ({
                season,
                seasonConfigId: "config_1",
                entries: season === 85 ? entries.map((e) => ({ ...e })) : [],
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const ranked = Object.values(result!.primes)[0]!;
        expect(ranked.length).toBe(1);
        expect(ranked[0]!.player).toBe("Alice");
    });

    test("should limit results to top 3 per prime", async () => {
        const entries: Raid[] = [
            // 4 players with 2+ tokens each
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            makeRaid({ userId: "player-b", damageDealt: 200000 }),
            makeRaid({ userId: "player-b", damageDealt: 200000 }),
            makeRaid({ userId: "player-c", damageDealt: 300000 }),
            makeRaid({ userId: "player-c", damageDealt: 300000 }),
            makeRaid({ userId: "player-d", damageDealt: 400000 }),
            makeRaid({ userId: "player-d", damageDealt: 400000 }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: entries.map((e) => ({ ...e })),
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const ranked = Object.values(result!.primes)[0]!;
        expect(ranked.length).toBe(3);
        // player-a (lowest) should be excluded
        expect(ranked[0]!.player).toBe("Diana"); // 400k
        expect(ranked[1]!.player).toBe("Charlie"); // 300k
        expect(ranked[2]!.player).toBe("Bob"); // 200k
    });

    test("should filter by rarity correctly", async () => {
        const entries: Raid[] = [
            makeRaid({
                userId: "player-a",
                damageDealt: 100000,
                rarity: Rarity.LEGENDARY,
            }),
            makeRaid({
                userId: "player-a",
                damageDealt: 100000,
                rarity: Rarity.LEGENDARY,
            }),
            makeRaid({
                userId: "player-b",
                damageDealt: 200000,
                rarity: Rarity.MYTHIC,
                unitId: "prime_unit_mythic_boss",
            }),
            makeRaid({
                userId: "player-b",
                damageDealt: 200000,
                rarity: Rarity.MYTHIC,
                unitId: "prime_unit_mythic_boss",
            }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: entries.map((e) => ({ ...e })),
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());

        // Only Legendary
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );
        expect(result).not.toBeNull();
        const ranked = Object.values(result!.primes)[0]!;
        expect(ranked.length).toBe(1);
        expect(ranked[0]!.player).toBe("Alice");
    });

    test("should aggregate data from multiple seasons", async () => {
        const mockClient = createMockClient({
            getGuildRaidBySeason: async (_apiKey: string, season: number) => {
                if (season === 85) {
                    return {
                        season: 85,
                        seasonConfigId: "config_1",
                        entries: [
                            makeRaid({
                                userId: "player-a",
                                damageDealt: 100000,
                            }),
                        ],
                    };
                }
                if (season === 84) {
                    return {
                        season: 84,
                        seasonConfigId: "config_1",
                        entries: [
                            makeRaid({
                                userId: "player-a",
                                damageDealt: 200000,
                            }),
                        ],
                    };
                }
                return { season, seasonConfigId: "config_1", entries: [] };
            },
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const ranked = Object.values(result!.primes)[0]!;
        expect(ranked[0]!.player).toBe("Alice");
        // avg of 100k + 200k = 150k
        expect(ranked[0]!.avgDmg).toBe(150000);
        expect(ranked[0]!.tokens).toBe(2);

        // Should report which seasons contributed
        expect(result!.seasonsUsed).toContain(85);
        expect(result!.seasonsUsed).toContain(84);
    });

    test("should fetch current season when no season is specified", async () => {
        const entries: Raid[] = [
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
        ];

        const mockClient = createMockClient({
            getGuildRaidByCurrentSeason: async () => ({
                season: 90,
                seasonConfigId: "config_1",
                entries: [],
            }),
            getGuildRaidBySeason: async () => ({
                season: 90,
                seasonConfigId: "config_1",
                entries: entries.map((e) => ({ ...e })),
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
        );

        expect(result).not.toBeNull();
        expect(result!.seasonsUsed).toContain(90);
    });

    test("should exclude bomb entries from prime calculations", async () => {
        const entries: Raid[] = [
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            makeRaid({
                userId: "player-a",
                damageDealt: 50000,
                damageType: DamageType.BOMB,
            }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async (_apiKey: string, season: number) => ({
                season,
                seasonConfigId: "config_1",
                entries: season === 85 ? entries.map((e) => ({ ...e })) : [],
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const ranked = Object.values(result!.primes)[0]!;
        // Bomb should not count
        expect(ranked[0]!.tokens).toBe(2);
        expect(ranked[0]!.avgDmg).toBe(100000);
    });

    test("should exclude non-SIDE_BOSS entries from prime tracking", async () => {
        const entries: Raid[] = [
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            makeRaid({ userId: "player-a", damageDealt: 100000 }),
            // Regular boss entry should not be included in prime results
            makeRaid({
                userId: "player-a",
                damageDealt: 500000,
                encounterType: EncounterType.BOSS,
                unitId: "mainboss",
                type: "MainBoss",
            }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async (_apiKey: string, season: number) => ({
                season,
                seasonConfigId: "config_1",
                entries: season === 85 ? entries.map((e) => ({ ...e })) : [],
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const ranked = Object.values(result!.primes)[0]!;
        expect(ranked[0]!.tokens).toBe(2);
        expect(ranked[0]!.avgDmg).toBe(100000);
    });

    test("should group different primes separately", async () => {
        const entries: Raid[] = [
            // Prime A
            makeRaid({
                userId: "player-a",
                damageDealt: 150000,
                unitId: "prime_unit_ragnar",
            }),
            makeRaid({
                userId: "player-a",
                damageDealt: 150000,
                unitId: "prime_unit_ragnar",
            }),
            // Prime B (different unitId)
            makeRaid({
                userId: "player-b",
                damageDealt: 200000,
                unitId: "prime_unit_abraxas",
            }),
            makeRaid({
                userId: "player-b",
                damageDealt: 200000,
                unitId: "prime_unit_abraxas",
            }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: entries.map((e) => ({ ...e })),
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const primeKeys = Object.keys(result!.primes);
        expect(primeKeys.length).toBe(2);
    });

    test("should return seasonsUsed in ascending order", async () => {
        const mockClient = createMockClient({
            getGuildRaidBySeason: async (_apiKey: string, season: number) => {
                if (season >= 82 && season <= 85) {
                    return {
                        season,
                        seasonConfigId: "config_1",
                        entries: [
                            makeRaid({
                                userId: "player-a",
                                damageDealt: 100000,
                            }),
                        ],
                    };
                }
                return { season, seasonConfigId: "config_1", entries: [] };
            },
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY,
            85,
        );

        expect(result).not.toBeNull();
        const seasons = result!.seasonsUsed;
        for (let i = 1; i < seasons.length; i++) {
            expect(seasons[i]!).toBeGreaterThan(seasons[i - 1]!);
        }
    });

    test("should handle LEGENDARY_PLUS rarity by expanding to LEGENDARY and MYTHIC", async () => {
        const entries: Raid[] = [
            makeRaid({
                userId: "player-a",
                damageDealt: 100000,
                rarity: Rarity.LEGENDARY,
            }),
            makeRaid({
                userId: "player-a",
                damageDealt: 100000,
                rarity: Rarity.LEGENDARY,
            }),
            makeRaid({
                userId: "player-b",
                damageDealt: 200000,
                rarity: Rarity.MYTHIC,
                unitId: "prime_unit_mythic",
                tier: 5,
            }),
            makeRaid({
                userId: "player-b",
                damageDealt: 200000,
                rarity: Rarity.MYTHIC,
                unitId: "prime_unit_mythic",
                tier: 5,
            }),
        ];

        const mockClient = createMockClient({
            getGuildRaidBySeason: async () => ({
                season: 85,
                seasonConfigId: "config_1",
                entries: entries.map((e) => ({ ...e })),
            }),
        });
        const service = new RaidAnalyticsService(mockClient, createMockDb());
        const result = await service.getPrimeSpecialists(
            "user-1",
            Rarity.LEGENDARY_PLUS,
            85,
        );

        expect(result).not.toBeNull();
        // Both legendary and mythic primes should be included
        const primeKeys = Object.keys(result!.primes);
        expect(primeKeys.length).toBe(2);
    });
});
