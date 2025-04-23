import type { DamageType, EncounterType, Rarity } from "../enums";
import type { PublicHeroDetail } from "./PublicHeroDetail";

export interface Raid {
    userId: string;
    tier: number;
    set: number;
    encounterIndexz: number;
    remainingHp: number;
    maxHp: number;
    encounterType: EncounterType;
    unitId: string;
    type: string;
    rarity: Rarity;
    damageDealt: number;
    damageType: DamageType;
    startedOn: Date;
    completedOn: Date;
    heroDetails: PublicHeroDetail[];
    machineOfWarDetails: PublicHeroDetail;
    globalConfigHash: string;
}
