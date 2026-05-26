import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController, logger } from "@/lib";
import { getMetaTeam } from "@/lib/utils/metaTeamUtils";
import { createUnknownUserTracker } from "@/lib/utils/userUtils";
import { getPrimeDisplayName } from "@/lib/utils/utils";
import { DamageType, EncounterType } from "@/models/enums";
import { MetaTeams } from "@/models/enums/MetaTeams";
import type { Raid } from "@/models/types";
import { GuildService } from "./GuildService";

export interface Achievement {
    emoji: string;
    name: string;
    description: string;
    player: string;
    value: string;
}

export class AchievementService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    async getGuildAchievements(
        discordId: string,
        season?: number,
    ): Promise<Achievement[] | null> {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) return null;

            const guildService = new GuildService(this.client);
            const players = await guildService.fetchGuildMembers(discordId);
            if (!players) return null;

            let seasonNumber = season;
            if (!seasonNumber) {
                const current =
                    await this.client.getGuildRaidByCurrentSeason(apiKey);
                if (!current?.season) return null;
                seasonNumber = current.season;
            }

            const response = await this.client.getGuildRaidBySeason(
                apiKey,
                seasonNumber,
            );
            const allEntries = response?.entries ?? [];
            if (allEntries.length === 0) return null;

            const entries = allEntries.filter(
                (entry) => entry.damageType === DamageType.BATTLE,
            );
            const bombEntries = allEntries.filter(
                (entry) => entry.damageType === DamageType.BOMB,
            );
            if (entries.length === 0 && bombEntries.length === 0) return null;

            const unknownTracker = createUnknownUserTracker();
            for (const entry of [...entries, ...bombEntries]) {
                const player = players.find((p) => p.userId === entry.userId);
                if (player) {
                    entry.userId = player.displayName;
                } else {
                    entry.userId = unknownTracker.getLabel(entry.userId);
                }
            }

            const validEntries = entries.filter(
                (e) => !e.userId.startsWith("Unknown #"),
            );
            const validBombs = bombEntries.filter(
                (e) => !e.userId.startsWith("Unknown #"),
            );

            // Get previous season for "Most Improved"
            let prevEntries: Raid[] = [];
            if (seasonNumber > 1) {
                const prevResponse = await this.client.getGuildRaidBySeason(
                    apiKey,
                    seasonNumber - 1,
                );
                prevEntries = (prevResponse?.entries ?? []).filter(
                    (e) => e.damageType === DamageType.BATTLE,
                );
                for (const entry of prevEntries) {
                    const player = players.find(
                        (p) => p.userId === entry.userId,
                    );
                    if (player) {
                        entry.userId = player.displayName;
                    } else {
                        entry.userId = unknownTracker.getLabel(entry.userId);
                    }
                }
                prevEntries = prevEntries.filter(
                    (e) => !e.userId.startsWith("Unknown #"),
                );
            }

            const achievements = this.computeAchievements(
                validEntries,
                prevEntries,
                validBombs,
            );
            return achievements.length > 0 ? achievements : null;
        } catch (error) {
            logger.error(error, "Error calculating achievements");
            return null;
        }
    }

    private computeAchievements(
        entries: Raid[],
        prevEntries: Raid[],
        bombEntries: Raid[],
    ): Achievement[] {
        const achievements: Achievement[] = [];

        // Group entries by player
        const byPlayer: Record<string, Raid[]> = {};
        for (const entry of entries) {
            if (!byPlayer[entry.userId]) byPlayer[entry.userId] = [];
            byPlayer[entry.userId]!.push(entry);
        }

        const playerNames = Object.keys(byPlayer);
        if (playerNames.length === 0) return [];

        // 🎯 Sharpshooter — highest damage on a bomb
        if (bombEntries.length > 0) {
            const best = bombEntries.reduce((a, b) =>
                a.damageDealt > b.damageDealt ? a : b,
            );
            achievements.push({
                emoji: "🎯",
                name: "Sharpshooter",
                description: "Highest damage on a bomb",
                player: best.userId,
                value: best.damageDealt.toLocaleString(),
            });
        }

        // 💩 Worst Bomb — lowest damage on a bomb
        if (bombEntries.length > 0) {
            const worst = bombEntries.reduce((a, b) =>
                a.damageDealt < b.damageDealt ? a : b,
            );
            achievements.push({
                emoji: "💩",
                name: "Worst Bomb",
                description: "Lowest damage on a bomb",
                player: worst.userId,
                value: worst.damageDealt.toLocaleString(),
            });
        }

        // 💣 Demolitions Expert — most bombs used
        const bombsByPlayer: Record<string, number> = {};
        for (const bomb of bombEntries) {
            bombsByPlayer[bomb.userId] = (bombsByPlayer[bomb.userId] ?? 0) + 1;
        }
        const demolitions = Object.entries(bombsByPlayer)
            .filter(([name]) => playerNames.includes(name))
            .sort(([, a], [, b]) => b - a)[0];
        if (demolitions && demolitions[1] > 0) {
            achievements.push({
                emoji: "💣",
                name: "Demolitions Expert",
                description: "Most bombs used",
                player: demolitions[0],
                value: `${demolitions[1]} bombs`,
            });
        }

        // 🧹 Sweeper — most sweeps (killing blows on low-hp bosses)
        const sweeper = this.findMaxByPlayer(
            byPlayer,
            playerNames,
            (raids) => raids.filter((r) => r.remainingHp === 0).length,
        );
        if (sweeper && sweeper.value > 0) {
            achievements.push({
                emoji: "🧹",
                name: "Sweeper",
                description: "Most sweeps performed",
                player: sweeper.player,
                value: `${sweeper.value} sweeps`,
            });
        }

        // 🗡️ Prime Hunter — most tokens used against primes
        const primeHunter = this.findMaxByPlayer(
            byPlayer,
            playerNames,
            (raids) =>
                raids.filter((r) => r.encounterType === EncounterType.SIDE_BOSS)
                    .length,
        );
        if (primeHunter && primeHunter.value > 0) {
            achievements.push({
                emoji: "🗡️",
                name: "Prime Hunter",
                description: "Most tokens used against primes",
                player: primeHunter.player,
                value: `${primeHunter.value} tokens`,
            });
        }

        // 🏋️ Workhorse — most tokens used
        const workhorse = this.findMaxByPlayer(
            byPlayer,
            playerNames,
            (raids) => raids.length,
        );
        if (workhorse) {
            achievements.push({
                emoji: "🏋️",
                name: "Workhorse",
                description: "Most tokens used",
                player: workhorse.player,
                value: `${workhorse.value} tokens`,
            });
        }

        // 😴 Snooze Button — fewest tokens used (non-zero)
        const snooze = this.findMinByPlayer(
            byPlayer,
            playerNames,
            (raids) => raids.length,
            1,
        );
        if (snooze) {
            achievements.push({
                emoji: "😴",
                name: "Snooze Button",
                description: "Fewest tokens used",
                player: snooze.player,
                value: `${snooze.value} tokens`,
            });
        }

        // 🔨 One-Track Mind — most tokens spent on the same boss
        let bestOneTrack: {
            player: string;
            boss: string;
            count: number;
        } | null = null;
        for (const name of playerNames) {
            const raids = byPlayer[name]!;
            const byCombinedBoss: Record<string, number> = {};
            for (const raid of raids) {
                const key =
                    raid.encounterType === EncounterType.SIDE_BOSS
                        ? getPrimeDisplayName(raid.unitId)
                        : raid.type;
                byCombinedBoss[key] = (byCombinedBoss[key] ?? 0) + 1;
            }
            for (const [boss, count] of Object.entries(byCombinedBoss)) {
                if (!bestOneTrack || count > bestOneTrack.count) {
                    bestOneTrack = { player: name, boss, count };
                }
            }
        }
        if (bestOneTrack) {
            achievements.push({
                emoji: "🔨",
                name: "One-Track Mind",
                description: `Most tokens on a single boss (${bestOneTrack.boss})`,
                player: bestOneTrack.player,
                value: `${bestOneTrack.count} tokens`,
            });
        }

        // 🧱 The Wall — highest avg damage per token (min 10 tokens)
        const wall = this.findMaxByPlayer(byPlayer, playerNames, (raids) => {
            if (raids.length < 10) return 0;
            return raids.reduce((s, e) => s + e.damageDealt, 0) / raids.length;
        });
        if (wall && wall.value > 0) {
            achievements.push({
                emoji: "🧱",
                name: "The Wall",
                description: "Highest avg damage per token",
                player: wall.player,
                value: Math.round(wall.value).toLocaleString(),
            });
        }

        // 📈 Most Improved — biggest % increase vs prev season
        if (prevEntries.length > 0) {
            const prevByPlayer: Record<string, Raid[]> = {};
            for (const entry of prevEntries) {
                if (!prevByPlayer[entry.userId])
                    prevByPlayer[entry.userId] = [];
                prevByPlayer[entry.userId]!.push(entry);
            }

            let bestImproved: { player: string; pctIncrease: number } | null =
                null;
            for (const name of playerNames) {
                const current = byPlayer[name];
                const prev = prevByPlayer[name];
                if (!current || current.length < 5 || !prev || prev.length < 5)
                    continue;

                const currAvg =
                    current.reduce((s, e) => s + e.damageDealt, 0) /
                    current.length;
                const prevAvg =
                    prev.reduce((s, e) => s + e.damageDealt, 0) / prev.length;
                if (prevAvg === 0) continue;

                const pctIncrease = ((currAvg - prevAvg) / prevAvg) * 100;
                if (!bestImproved || pctIncrease > bestImproved.pctIncrease) {
                    bestImproved = { player: name, pctIncrease };
                }
            }

            if (bestImproved && bestImproved.pctIncrease > 0) {
                achievements.push({
                    emoji: "📈",
                    name: "Most Improved",
                    description:
                        "Biggest avg dmg/token increase vs previous season",
                    player: bestImproved.player,
                    value: `+${Math.round(bestImproved.pctIncrease)}%`,
                });
            }
        }

        // 🎪 Variety Show — most different team compositions
        const variety = this.findMaxByPlayer(byPlayer, playerNames, (raids) => {
            const comps = new Set<string>();
            for (const raid of raids) {
                if (raid.heroDetails && raid.heroDetails.length > 0) {
                    const comp = raid.heroDetails
                        .map((h) => h.unitId)
                        .sort()
                        .join(",");
                    comps.add(comp);
                }
            }
            return comps.size;
        });
        if (variety && variety.value > 1) {
            achievements.push({
                emoji: "🎪",
                name: "Variety Show",
                description: "Most different team compositions",
                player: variety.player,
                value: `${variety.value} comps`,
            });
        }

        // ⏰ Early Bird — most tokens in first 3 days
        const seasonStart = this.getSeasonStart(entries);
        if (seasonStart) {
            const threeDays = seasonStart + 3 * 24 * 60 * 60;
            const earlyBird = this.findMaxByPlayer(
                byPlayer,
                playerNames,
                (raids) =>
                    raids.filter((r) => r.startedOn && r.startedOn <= threeDays)
                        .length,
            );
            if (earlyBird && earlyBird.value > 0) {
                achievements.push({
                    emoji: "⏰",
                    name: "Early Bird",
                    description: "Most tokens used in first 3 days",
                    player: earlyBird.player,
                    value: `${earlyBird.value} tokens`,
                });
            }
        }

        // 🪖 Meta Slave — highest % meta team usage
        const metaSlave = this.findMaxByPlayer(
            byPlayer,
            playerNames,
            (raids) => {
                const withHeroes = raids.filter(
                    (r) => r.heroDetails && r.heroDetails.length > 0,
                );
                if (withHeroes.length < 5) return 0;
                const metaCount = withHeroes.filter((r) => {
                    const heroes = r.heroDetails.map((h) => h.unitId);
                    return getMetaTeam(heroes) !== MetaTeams.OTHER;
                }).length;
                return (metaCount / withHeroes.length) * 100;
            },
        );
        if (metaSlave && metaSlave.value > 0) {
            achievements.push({
                emoji: "🪖",
                name: "Meta Slave",
                description: "Highest % meta team usage",
                player: metaSlave.player,
                value: `${Math.round(metaSlave.value)}%`,
            });
        }

        // 🧪 Mad Scientist — lowest % meta team usage
        const madScientist = this.findMinByPlayer(
            byPlayer,
            playerNames,
            (raids) => {
                const withHeroes = raids.filter(
                    (r) => r.heroDetails && r.heroDetails.length > 0,
                );
                if (withHeroes.length < 5) return Infinity;
                const metaCount = withHeroes.filter((r) => {
                    const heroes = r.heroDetails.map((h) => h.unitId);
                    return getMetaTeam(heroes) !== MetaTeams.OTHER;
                }).length;
                return (metaCount / withHeroes.length) * 100;
            },
        );
        if (madScientist && madScientist.value < Infinity) {
            achievements.push({
                emoji: "🧪",
                name: "Mad Scientist",
                description: "Lowest % meta team usage",
                player: madScientist.player,
                value: `${Math.round(madScientist.value)}%`,
            });
        }

        // 🤝 Team Player — closest to guild average damage per token
        const guildAvg =
            entries.reduce((s, e) => s + e.damageDealt, 0) / entries.length;
        let closestPlayer: { player: string; diff: number } | null = null;
        for (const name of playerNames) {
            const raids = byPlayer[name];
            if (!raids || raids.length < 5) continue;
            const playerAvg =
                raids.reduce((s, e) => s + e.damageDealt, 0) / raids.length;
            const diff = Math.abs(playerAvg - guildAvg);
            if (!closestPlayer || diff < closestPlayer.diff) {
                closestPlayer = { player: name, diff };
            }
        }
        if (closestPlayer) {
            const pctDiff = ((closestPlayer.diff / guildAvg) * 100).toFixed(1);
            achievements.push({
                emoji: "🤝",
                name: "Team Player",
                description: "Closest to guild average dmg/token",
                player: closestPlayer.player,
                value: `${pctDiff}% off avg`,
            });
        }

        return achievements;
    }

    private findMaxByPlayer(
        byPlayer: Record<string, Raid[]>,
        playerNames: string[],
        getValue: (raids: Raid[]) => number,
    ): { player: string; value: number } | null {
        let best: { player: string; value: number } | null = null;
        for (const name of playerNames) {
            const raids = byPlayer[name];
            if (!raids) continue;
            const val = getValue(raids);
            if (!best || val > best.value) {
                best = { player: name, value: val };
            }
        }
        return best;
    }

    private findMinByPlayer(
        byPlayer: Record<string, Raid[]>,
        playerNames: string[],
        getValue: (raids: Raid[]) => number,
        minThreshold = 0,
    ): { player: string; value: number } | null {
        let best: { player: string; value: number } | null = null;
        for (const name of playerNames) {
            const raids = byPlayer[name];
            if (!raids) continue;
            const val = getValue(raids);
            if (val < minThreshold) continue;
            if (!best || val < best.value) {
                best = { player: name, value: val };
            }
        }
        return best;
    }

    private getSeasonStart(entries: Raid[]): number | null {
        let earliest = Infinity;
        for (const entry of entries) {
            if (entry.startedOn && entry.startedOn < earliest) {
                earliest = entry.startedOn;
            }
        }
        return earliest === Infinity ? null : earliest;
    }
}
