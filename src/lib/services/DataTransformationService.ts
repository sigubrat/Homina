import type { Raid } from "@/models/types";
import type {
    TimeUsedResult,
    TimeUsedRow,
    TimeUsedLoop,
    TimeUsedTypeGroup,
} from "@/models/types/TimeUsed";
import {
    mapTierToRarity,
    getBossEmoji,
    getPrimeDisplayName,
    mapUnitIdToEmoji,
    splitByCapital,
} from "../utils/utils";
import { normalizeTimestamp, SecondsToString } from "../utils/timeUtils";
import { DamageType, EncounterType } from "@/models/enums";
import type { Highscore } from "@/models/types/Highscore";
import { getMetaTeam } from "@/lib/utils/metaTeamUtils";

export class DataTransformationService {
    constructor() {}

    timeUsedPerBoss(seasonData: Raid[]): TimeUsedResult {
        if (seasonData.length === 0) {
            return { groups: [], totalTime: "0s" };
        }

        // Step 1: Bucket entries by .type
        const byType = new Map<string, Raid[]>();
        for (const entry of seasonData) {
            const existing = byType.get(entry.type);
            if (existing) {
                existing.push(entry);
            } else {
                byType.set(entry.type, [entry]);
            }
        }

        // Step 2: For each type, sub-bucket by tier to form loops
        const groups: TimeUsedTypeGroup[] = [];

        for (const [type, entries] of byType) {
            // Sub-bucket by tier
            const byTier = new Map<number, Raid[]>();
            for (const entry of entries) {
                const existing = byTier.get(entry.tier);
                if (existing) {
                    existing.push(entry);
                } else {
                    byTier.set(entry.tier, [entry]);
                }
            }

            // Sort tiers ascending to assign loop indices
            const sortedTiers = [...byTier.keys()].sort((a, b) => a - b);

            const loops: TimeUsedLoop[] = [];
            for (let i = 0; i < sortedTiers.length; i++) {
                const tier = sortedTiers[i]!;
                const tierEntries = byTier.get(tier)!;

                // Derive rarityLabel from the first entry's tier and set
                const firstEntry = tierEntries[0]!;
                const rarityLabel = mapTierToRarity(
                    tier,
                    firstEntry.set + 1,
                    false,
                );

                // Split by encounterType
                const bossAttacks = tierEntries.filter(
                    (e) => e.encounterType === EncounterType.BOSS,
                );
                const primeAttacks = tierEntries.filter(
                    (e) => e.encounterType === EncounterType.SIDE_BOSS,
                );

                // Build boss row
                let bossRow: TimeUsedRow | null = null;
                if (bossAttacks.length > 0) {
                    bossRow = this.buildRow(
                        "boss",
                        type,
                        getBossEmoji(type) ?? "❓",
                        bossAttacks,
                    );
                }

                // Build prime rows — sub-bucket by unitId
                const primesByUnitId = new Map<string, Raid[]>();
                for (const attack of primeAttacks) {
                    const existing = primesByUnitId.get(attack.unitId);
                    if (existing) {
                        existing.push(attack);
                    } else {
                        primesByUnitId.set(attack.unitId, [attack]);
                    }
                }

                const primeRows: TimeUsedRow[] = [];
                for (const [unitId, attacks] of primesByUnitId) {
                    const displayName = getPrimeDisplayName(unitId);
                    const emoji = mapUnitIdToEmoji(unitId);
                    primeRows.push(
                        this.buildRow(
                            "prime",
                            displayName,
                            emoji,
                            attacks,
                            unitId,
                        ),
                    );
                }
                // Sort primes by firstStartedOn
                primeRows.sort((a, b) => a.firstStartedOn - b.firstStartedOn);

                // Build total row — aggregate all entries in this (type, tier) bucket
                const totalRow = this.buildRow(
                    "total",
                    "Total",
                    "",
                    tierEntries,
                );

                loops.push({
                    tier,
                    loopIndex: i + 1,
                    rarityLabel,
                    bossRow,
                    primeRows,
                    totalRow,
                });
            }

            // Group-level metadata
            const allStartedOn = entries.map((e) =>
                normalizeTimestamp(e.startedOn),
            );
            const groupFirstStartedOn = Math.min(...allStartedOn);
            const emoji = getBossEmoji(type) ?? "❓";

            groups.push({
                type,
                displayName: type,
                emoji,
                firstStartedOn: groupFirstStartedOn,
                loops,
            });
        }

        // Sort groups by firstStartedOn (gameplay chronology)
        groups.sort((a, b) => a.firstStartedOn - b.firstStartedOn);

        // Compute total time across all entries
        const allStartedOn = seasonData.map((e) =>
            normalizeTimestamp(e.startedOn),
        );
        const totalTime = SecondsToString(
            Math.max(...allStartedOn) - Math.min(...allStartedOn),
        );

        return { groups, totalTime };
    }

    private buildRow(
        kind: "boss" | "prime" | "total",
        displayName: string,
        emoji: string,
        attacks: Raid[],
        unitId?: string,
    ): TimeUsedRow {
        const timestamps = attacks.map((a) => normalizeTimestamp(a.startedOn));
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);

        const tokens = attacks.filter(
            (a) => a.damageType === DamageType.BATTLE,
        ).length;
        const bombs = attacks.length - tokens;

        return {
            kind,
            displayName,
            emoji,
            unitId,
            time: maxTs - minTs,
            tokens,
            bombs,
            firstStartedOn: minTs,
        };
    }

    async seasonHighscores(seasonData: Raid[]) {
        const result: Record<string, Highscore[]> = {};

        for (const raid of seasonData) {
            const unitWords = raid.unitId.split(/(?=[A-Z])/);
            const unit = `${unitWords.at(-2)}${unitWords.at(-1)}`;
            const key = `${mapTierToRarity(
                raid.tier,
                raid.set + 1,
                false,
            )} ${unit}`;

            if (!result[key]) {
                result[key] = [];
            }

            const existingEntry = result[key].find(
                (entry) => entry.username === raid.userId,
            );

            const team = raid.heroDetails.map((hero) => hero.unitId);
            const metaTeam = getMetaTeam(team);

            if (!existingEntry) {
                result[key].push({
                    username: raid.userId,
                    value: raid.damageDealt,
                    team: metaTeam,
                });
            } else {
                if (raid.damageDealt > existingEntry.value) {
                    existingEntry.value = raid.damageDealt;
                    existingEntry.team = metaTeam;
                }
            }
        }

        // Sort each highscore array by value in descending order
        for (const key in result) {
            result[key]?.sort((a, b) => b.value - a.value);
        }

        return result;
    }

    async highestDmgComps(seasonData: Raid[]) {
        const maxPerBoss: Record<string, Raid> = {};

        for (const raid of seasonData) {
            const unitWords = splitByCapital(raid.unitId);
            const key = unitWords.at(-2)! + unitWords.at(-1)!;
            if (
                !maxPerBoss[key] ||
                raid.damageDealt > maxPerBoss[key].damageDealt
            ) {
                maxPerBoss[key] = raid;
            }
        }

        return maxPerBoss;
    }
}
