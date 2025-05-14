import type { GuildRaidResult } from "@/models/types";

export const guildRaidResultFixture: GuildRaidResult[] = [
    {
        username: "testUser1",
        tier: 0,
        set: 0,
        boss: "TervigonLeviathan",
        totalDamage: 18000,
        totalTokens: 1,
        startedOn: 1742984513,
    },
    {
        username: "testUser22",
        tier: 0,
        set: 1,
        boss: "HiveTyrantLeviathan",
        totalDamage: 27000,
        totalTokens: 1,
        startedOn: 1742984574,
    },
    {
        username: "testUser22",
        tier: 0,
        set: 2,
        boss: "HiveTyrantGorgon",
        totalDamage: 36000,
        startedOn: 1742984633,
        totalTokens: 1,
    },
    {
        username: "testUser24",
        tier: 0,
        set: 3,
        boss: "ScreamerKiller",
        totalDamage: 91135,
        startedOn: 1742985806,
        totalTokens: 2,
    },
    {
        username: "testUser32",
        tier: 0,
        set: 3,
        boss: "ScreamerKiller",
        startedOn: 1742986285,
        totalDamage: 27800,
        totalTokens: 1,
    },
];
