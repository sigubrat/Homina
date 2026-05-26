import { HominaTacticusClient } from "@/client";
import { DatabaseController, dbController, logger } from "@/lib";
import { getMetaTeam } from "@/lib/utils/metaTeamUtils";
import { expandRarity } from "@/lib/utils/rarityUtils";
import { DamageType, EncounterType, Rarity } from "@/models/enums";
import { MetaTeams } from "@/models/enums/MetaTeams";
import type { Raid } from "@/models/types";
import type { TeamDistribution } from "@/models/types/TeamDistribution";

export class MetaTeamService {
    private client: HominaTacticusClient;
    private db: DatabaseController;

    constructor(client = new HominaTacticusClient(), db = dbController) {
        this.client = client;
        this.db = db;
    }

    async getMetaTeamDistribution(
        discordId: string,
        season: number,
        tier?: Rarity,
    ) {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            let entries: Raid[] = resp.entries;

            if (tier) {
                const rarities = expandRarity(tier);
                entries = entries.filter((entry) =>
                    rarities.includes(entry.rarity),
                );
            }

            const totalDistribution: TeamDistribution = {
                mech: 0,
                multihit: 0,
                neuro: 0,
                mechDamage: 0,
                multihitDamage: 0,
                neuroDamage: 0,
                other: 0,
                otherDamage: 0,
                custodes: 0,
                battlesuit: 0,
                battlesuitDamage: 0,
            };

            for (const entry of entries) {
                if (
                    !entry.userId ||
                    entry.damageType === DamageType.BOMB ||
                    entry.encounterType === EncounterType.SIDE_BOSS
                ) {
                    continue;
                }

                const heroes = entry.heroDetails.map((hero) => hero.unitId);
                const team = getMetaTeam(heroes);

                if (team === MetaTeams.ADMECH) {
                    totalDistribution.mech = (totalDistribution.mech || 0) + 1;
                    totalDistribution.mechDamage =
                        (totalDistribution.mechDamage || 0) + entry.damageDealt;
                } else if (team === MetaTeams.MULTIHIT) {
                    totalDistribution.multihit =
                        (totalDistribution.multihit || 0) + 1;
                    totalDistribution.multihitDamage =
                        (totalDistribution.multihitDamage || 0) +
                        entry.damageDealt;
                } else if (team === MetaTeams.NEURO) {
                    totalDistribution.neuro =
                        (totalDistribution.neuro || 0) + 1;
                    totalDistribution.neuroDamage =
                        (totalDistribution.neuroDamage || 0) +
                        entry.damageDealt;
                } else if (team === MetaTeams.CUSTODES) {
                    totalDistribution.custodes =
                        (totalDistribution.custodes || 0) + 1;
                    totalDistribution.custodesDamage =
                        (totalDistribution.custodesDamage || 0) +
                        entry.damageDealt;
                } else if (team === MetaTeams.BATTLESUIT) {
                    totalDistribution.battlesuit =
                        (totalDistribution.battlesuit || 0) + 1;
                    totalDistribution.battlesuitDamage =
                        (totalDistribution.battlesuitDamage || 0) +
                        entry.damageDealt;
                } else {
                    totalDistribution.other =
                        (totalDistribution.other || 0) + 1;
                    totalDistribution.otherDamage =
                        (totalDistribution.otherDamage || 0) +
                        entry.damageDealt;
                }
            }

            return totalDistribution;
        } catch (error) {
            logger.error(error, "Error fetching guild seasons: ");
            return null;
        }
    }

    async getMetaTeamDistributionPerPlayer(
        discordId: string,
        season: number,
        tier?: Rarity,
    ) {
        try {
            const apiKey = await this.db.getUserToken(discordId);
            if (!apiKey) {
                return null;
            }

            const resp = await this.client.getGuildRaidBySeason(apiKey, season);
            if (!resp || !resp.entries) {
                return null;
            }

            let entries: Raid[] = resp.entries;

            if (tier) {
                const rarities = expandRarity(tier);
                entries = entries.filter((entry) =>
                    rarities.includes(entry.rarity),
                );
            }

            const groupedResults: Record<string, Raid[]> = {};
            for (const entry of entries) {
                const username = entry.userId;
                if (
                    !entry.userId ||
                    entry.damageType === DamageType.BOMB ||
                    entry.encounterType === EncounterType.SIDE_BOSS
                ) {
                    continue;
                }

                if (!groupedResults[username]) {
                    groupedResults[username] = [];
                }

                groupedResults[username].push(entry);
            }

            const result: Record<string, TeamDistribution> = {};
            for (const username in groupedResults) {
                const entries = groupedResults[username];

                if (!entries) {
                    continue;
                }

                const totalDistribution: TeamDistribution = {
                    mech: 0,
                    multihit: 0,
                    neuro: 0,
                    custodes: 0,
                    mechDamage: 0,
                    multihitDamage: 0,
                    neuroDamage: 0,
                    other: 0,
                    otherDamage: 0,
                    custodesDamage: 0,
                    battlesuit: 0,
                    battlesuitDamage: 0,
                };

                for (const entry of entries) {
                    if (
                        !entry.userId ||
                        entry.damageType === DamageType.BOMB ||
                        entry.encounterType === EncounterType.SIDE_BOSS
                    ) {
                        continue;
                    }

                    const heroes = entry.heroDetails.map((hero) => hero.unitId);
                    const metaTeam = getMetaTeam(heroes);

                    switch (metaTeam) {
                        case MetaTeams.ADMECH:
                            totalDistribution.mech =
                                (totalDistribution.mech || 0) + 1;
                            totalDistribution.mechDamage =
                                (totalDistribution.mechDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.MULTIHIT:
                            totalDistribution.multihit =
                                (totalDistribution.multihit || 0) + 1;
                            totalDistribution.multihitDamage =
                                (totalDistribution.multihitDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.NEURO:
                            totalDistribution.neuro =
                                (totalDistribution.neuro || 0) + 1;
                            totalDistribution.neuroDamage =
                                (totalDistribution.neuroDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.CUSTODES:
                            totalDistribution.custodes =
                                (totalDistribution.custodes || 0) + 1;
                            totalDistribution.custodesDamage =
                                (totalDistribution.custodesDamage || 0) +
                                entry.damageDealt;
                            break;
                        case MetaTeams.BATTLESUIT:
                            totalDistribution.battlesuit =
                                (totalDistribution.battlesuit || 0) + 1;
                            totalDistribution.battlesuitDamage =
                                (totalDistribution.battlesuitDamage || 0) +
                                entry.damageDealt;
                            break;
                        default:
                            totalDistribution.other =
                                (totalDistribution.other || 0) + 1;
                            totalDistribution.otherDamage =
                                (totalDistribution.otherDamage || 0) +
                                entry.damageDealt;
                    }
                }

                const totalEntries = entries.length;
                const totalDamage =
                    totalDistribution.mechDamage! +
                    totalDistribution.multihitDamage! +
                    totalDistribution.neuroDamage! +
                    totalDistribution.custodesDamage! +
                    totalDistribution.battlesuitDamage! +
                    totalDistribution.otherDamage!;

                if (totalDamage === 0 || totalEntries === 0) {
                    result[username] = {
                        mech: 0,
                        multihit: 0,
                        neuro: 0,
                        custodes: 0,
                        other: 0,
                        mechDamage: 0,
                        multihitDamage: 0,
                        neuroDamage: 0,
                        custodesDamage: 0,
                        battlesuit: 0,
                        battlesuitDamage: 0,
                        otherDamage: 0,
                    };
                    continue;
                }

                const percentages: TeamDistribution = {
                    mech: (totalDistribution.mech / totalEntries) * 100,
                    multihit: (totalDistribution.multihit / totalEntries) * 100,
                    neuro: (totalDistribution.neuro / totalEntries) * 100,
                    custodes: (totalDistribution.custodes / totalEntries) * 100,
                    other: (totalDistribution.other / totalEntries) * 100,
                    battlesuit:
                        (totalDistribution.battlesuit / totalEntries) * 100,
                    mechDamage:
                        (totalDistribution.mechDamage! / totalDamage) * 100,
                    multihitDamage:
                        (totalDistribution.multihitDamage! / totalDamage) * 100,
                    neuroDamage:
                        (totalDistribution.neuroDamage! / totalDamage) * 100,
                    otherDamage:
                        (totalDistribution.otherDamage! / totalDamage) * 100,
                    custodesDamage:
                        (totalDistribution.custodesDamage! / totalDamage) * 100,
                    battlesuitDamage:
                        (totalDistribution.battlesuitDamage! / totalDamage) *
                        100,
                };

                result[username] = percentages;
            }

            return result;
        } catch (error) {
            logger.error(error, "Error fetching guild seasons: ");
            return null;
        }
    }
}
