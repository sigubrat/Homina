export interface GuildRaidResult {
    username: string;
    totalDamage: number;
    totalTokens: number;
    minDmg?: number;
    maxDmg?: number;
    boss: string;
    set: number;
    tier: number;
    startedOn: number;
    bombCount: number;
}
