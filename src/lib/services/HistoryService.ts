import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController } from "@/lib";
import { expandRarity } from "@/lib/utils/rarityUtils";
import { mapTierToRarity } from "@/lib/utils/utils";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import { BotError } from "@/models/errors/BotError";
import { DatabaseError, ExternalApiError } from "@/models/errors/ServiceError";
import { NotRegisteredError } from "@/models/errors/UserError";
import type { GuildRaidResult, Raid } from "@/models/types";
import { MINIMUM_SEASON_THRESHOLD } from "../configs/constants";
import { RaidAnalyticsService } from "./RaidAnalyticsService";

export class HistoryService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    private async requireApiKey(discordId: string): Promise<string> {
        let apiKey: string | null;
        try {
            apiKey = await this.db.getUserToken(discordId);
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new DatabaseError("Failed to retrieve API token", {
                cause: error,
                context: { discordId },
            });
        }
        if (!apiKey) throw new NotRegisteredError();
        return apiKey;
    }

    async getTokensUsedInLastSeasons(
        discordId: string,
        nSeasons: number,
        rarity?: Rarity,
    ): Promise<Record<number, Record<string, number>>> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!currentSeason || !currentSeason.season) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
            }

            const currentSeasonNumber = currentSeason.season;
            const seasons: number[] = [];
            for (let i = nSeasons - 1; i >= 0; i--) {
                if (currentSeasonNumber - i < MINIMUM_SEASON_THRESHOLD) {
                    break;
                }
                seasons.push(currentSeasonNumber - i);
            }

            const raidAnalytics = new RaidAnalyticsService(this.client);
            const seasonPromises = seasons.map((season) =>
                raidAnalytics.getGuildRaidResultBySeason(
                    discordId,
                    season,
                    rarity,
                    true,
                ),
            );

            const responses = await Promise.all(seasonPromises);

            const result: Record<number, Record<string, number>> = {};
            for (let idx = 0; idx < seasons.length; idx++) {
                const seasonNr = seasons[idx]!;
                const data = responses[idx];
                const tokensMap: Record<string, number> = {};
                if (data) {
                    for (const entry of data) {
                        tokensMap[entry.username] = entry.totalTokens || 0;
                    }
                }
                result[seasonNr] = tokensMap;
            }

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch tokens used in last seasons", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getTotalDamageInLastSeasons(
        discordId: string,
        nSeasons: number,
    ): Promise<Record<number, number>> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!currentSeason || !currentSeason.season) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
            }

            const currentSeasonNumber = currentSeason.season;
            const seasons: number[] = [];
            for (let i = nSeasons - 1; i >= 0; i--) {
                if (currentSeasonNumber - i < MINIMUM_SEASON_THRESHOLD) {
                    break;
                }
                seasons.push(currentSeasonNumber - i);
            }

            const raidAnalytics = new RaidAnalyticsService(this.client);
            const seasonPromises = seasons.map((season) =>
                raidAnalytics.getGuildRaidResultBySeason(discordId, season),
            );

            const responses = await Promise.all(seasonPromises);

            const result: Record<number, number> = {};
            for (let idx = 0; idx < seasons.length; idx++) {
                const seasonNr = seasons[idx]!;
                const data = responses[idx];
                result[seasonNr] = data
                    ? data.reduce((sum, r) => sum + r.totalDamage, 0)
                    : 0;
            }

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch total damage in last seasons", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getBossesKilledInLastSeasons(
        discordId: string,
        nSeasons: number,
        startingSeason?: number,
    ): Promise<Record<number, Partial<Record<Rarity, number>>>> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            let endSeason: number;
            if (startingSeason !== undefined) {
                endSeason = startingSeason;
            } else {
                const currentSeason =
                    await this.client.getGuildRaidByCurrentSeason(apiKey);
                if (!currentSeason || !currentSeason.season) {
                    throw new ExternalApiError("No current season data returned", {
                        context: { discordId },
                    });
                }
                endSeason = currentSeason.season;
            }

            const seasons: number[] = [];
            for (let i = nSeasons - 1; i >= 0; i--) {
                if (endSeason - i < MINIMUM_SEASON_THRESHOLD) {
                    break;
                }
                seasons.push(endSeason - i);
            }

            const seasonPromises = seasons.map((season) =>
                this.client.getGuildRaidBySeason(apiKey, season),
            );

            const responses = await Promise.all(seasonPromises);

            const result: Record<number, Partial<Record<Rarity, number>>> = {};
            for (let idx = 0; idx < seasons.length; idx++) {
                const seasonNr = seasons[idx]!;
                const resp = responses[idx];
                if (!resp || !resp.entries) {
                    result[seasonNr] = {};
                    continue;
                }

                const killedByRarity: Partial<Record<Rarity, number>> = {};
                const killedKeys = new Set<string>();
                for (const entry of resp.entries) {
                    if (entry.encounterType !== EncounterType.BOSS) {
                        continue;
                    }
                    if (entry.remainingHp !== 0) {
                        continue;
                    }
                    const key = `${entry.type}|${entry.tier}|${entry.set}`;
                    if (killedKeys.has(key)) continue;
                    killedKeys.add(key);
                    killedByRarity[entry.rarity] =
                        (killedByRarity[entry.rarity] ?? 0) + 1;
                }
                result[seasonNr] = killedByRarity;
            }

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch bosses killed in last seasons", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getLoopsCompletedInLastSeasons(
        discordId: string,
        nSeasons: number,
    ): Promise<Record<number, number>> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const currentSeason =
                await this.client.getGuildRaidByCurrentSeason(apiKey);
            if (!currentSeason || !currentSeason.season) {
                throw new ExternalApiError("No current season data returned", {
                    context: { discordId },
                });
            }

            const currentSeasonNumber = currentSeason.season;
            const seasons: number[] = [];
            for (let i = nSeasons - 1; i >= 0; i--) {
                if (currentSeasonNumber - i < MINIMUM_SEASON_THRESHOLD) {
                    break;
                }
                seasons.push(currentSeasonNumber - i);
            }

            const seasonPromises = seasons.map((season) =>
                this.client.getGuildRaidBySeason(apiKey, season),
            );

            const responses = await Promise.all(seasonPromises);

            const result: Record<number, number> = {};
            for (let idx = 0; idx < seasons.length; idx++) {
                const seasonNr = seasons[idx]!;
                const resp = responses[idx];
                if (!resp || !resp.entries) {
                    result[seasonNr] = 0;
                    continue;
                }

                const completedLoopKeys = new Set<string>();
                const bossEntries = resp.entries.filter(
                    (e) => e.encounterType === EncounterType.BOSS,
                );

                if (bossEntries.length === 0) {
                    result[seasonNr] = 0;
                    continue;
                }

                const rarityRank = (r: Rarity): number =>
                    Object.values(Rarity).indexOf(r);

                let capRarity: Rarity = bossEntries[0]!.rarity;
                let capSet: number = bossEntries[0]!.set;
                for (const entry of bossEntries) {
                    const entryRank = rarityRank(entry.rarity);
                    const capRank = rarityRank(capRarity);
                    if (
                        entryRank > capRank ||
                        (entryRank === capRank && entry.set > capSet)
                    ) {
                        capRarity = entry.rarity;
                        capSet = entry.set;
                    }
                }

                for (const entry of bossEntries) {
                    if (entry.rarity !== capRarity) {
                        continue;
                    }
                    if (entry.set !== capSet) {
                        continue;
                    }
                    if (entry.remainingHp !== 0) {
                        continue;
                    }
                    const key = `${entry.type}|${entry.tier}|${entry.set}`;
                    completedLoopKeys.add(key);
                }
                result[seasonNr] = completedLoopKeys.size;
            }

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch loops completed in last seasons", {
                cause: error,
                context: { discordId },
            });
        }
    }

    async getTokensPerLoopBySeason(
        discordId: string,
        season: number,
    ): Promise<Record<number, number> | null> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            const bossEntries = resp.entries.filter(
                (e) => e.encounterType === EncounterType.BOSS,
            );

            if (bossEntries.length === 0) {
                return null;
            }

            const rarityRank = (r: Rarity): number =>
                Object.values(Rarity).indexOf(r);

            let capRarity: Rarity = bossEntries[0]!.rarity;
            let capSet: number = bossEntries[0]!.set;
            for (const entry of bossEntries) {
                const entryRank = rarityRank(entry.rarity);
                const capRank = rarityRank(capRarity);
                if (
                    entryRank > capRank ||
                    (entryRank === capRank && entry.set > capSet)
                ) {
                    capRarity = entry.rarity;
                    capSet = entry.set;
                }
            }

            const completedTiers = new Set<number>();
            for (const entry of bossEntries) {
                if (
                    entry.rarity === capRarity &&
                    entry.set === capSet &&
                    entry.remainingHp === 0
                ) {
                    completedTiers.add(entry.tier);
                }
            }
            const sortedCapTiers = [...completedTiers].sort((a, b) => a - b);

            const result: Record<number, number> = {};
            for (const entry of resp.entries) {
                if (entry.damageType === DamageType.BOMB) {
                    continue;
                }
                let loopIndex = sortedCapTiers.findIndex(
                    (t) => entry.tier <= t,
                );
                if (loopIndex === -1) {
                    loopIndex = sortedCapTiers.length;
                }
                const loopNumber = loopIndex + 1;
                result[loopNumber] = (result[loopNumber] ?? 0) + 1;
            }

            return result;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch tokens per loop by season", {
                cause: error,
                context: { discordId, season },
            });
        }
    }

    async getTokensPerLoopByBoss(
        discordId: string,
        season: number,
        rarity: Rarity,
    ): Promise<Record<string, Record<number, number>> | null> {
        try {
            const apiKey = await this.requireApiKey(discordId);

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            const bossEntries = resp.entries.filter(
                (e) => e.encounterType === EncounterType.BOSS,
            );

            if (bossEntries.length === 0) {
                return null;
            }

            const rarityRank = (r: Rarity): number =>
                Object.values(Rarity).indexOf(r);

            let capRarity: Rarity = bossEntries[0]!.rarity;
            let capSet: number = bossEntries[0]!.set;
            for (const entry of bossEntries) {
                const entryRank = rarityRank(entry.rarity);
                const capRank = rarityRank(capRarity);
                if (
                    entryRank > capRank ||
                    (entryRank === capRank && entry.set > capSet)
                ) {
                    capRarity = entry.rarity;
                    capSet = entry.set;
                }
            }

            const completedTiers = new Set<number>();
            for (const entry of bossEntries) {
                if (
                    entry.rarity === capRarity &&
                    entry.set === capSet &&
                    entry.remainingHp === 0
                ) {
                    completedTiers.add(entry.tier);
                }
            }
            const sortedCapTiers = [...completedTiers].sort((a, b) => a - b);

            const rarities = expandRarity(rarity);

            const bossLabelMap = new Map<string, string>();
            for (const entry of resp.entries) {
                const key = `${entry.rarity}_${entry.type}`;
                if (
                    entry.encounterType === EncounterType.BOSS &&
                    rarities.includes(entry.rarity) &&
                    !bossLabelMap.has(key)
                ) {
                    const prefix = mapTierToRarity(
                        entry.tier,
                        entry.set + 1,
                        false,
                    );
                    bossLabelMap.set(key, `${prefix} ${entry.type}`);
                }
            }

            const result: Record<string, Record<number, number>> = {};

            for (const entry of resp.entries) {
                if (entry.damageType === DamageType.BOMB) {
                    continue;
                }
                if (!rarities.includes(entry.rarity)) {
                    continue;
                }

                const key = `${entry.rarity}_${entry.type}`;
                const bossLabel = bossLabelMap.get(key) ?? entry.type;

                let loopIndex = sortedCapTiers.findIndex(
                    (t) => entry.tier <= t,
                );
                if (loopIndex === -1) {
                    loopIndex = sortedCapTiers.length;
                }
                const loopNumber = loopIndex + 1;

                if (!result[bossLabel]) {
                    result[bossLabel] = {};
                }
                result[bossLabel][loopNumber] =
                    (result[bossLabel][loopNumber] ?? 0) + 1;
            }

            return Object.keys(result).length > 0 ? result : null;
        } catch (error) {
            if (error instanceof BotError) throw error;
            throw new ExternalApiError("Failed to fetch tokens per loop by boss", {
                cause: error,
                context: { discordId, season },
            });
        }
    }
}
