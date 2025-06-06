import type { Rarity } from "../enums";
import type { Slot } from "../enums/Slot";

export interface UnitItem {
    slotId: Slot; // e.g., "Slot1"
    level: number; // 1-11, e.g., 2
    id: string; // e.g., "I_Crit_R002"
    name?: string; // e.g., "Sanctified Bolt Pistol"
    rarity?: Rarity; // e.g., "Rare"
}
