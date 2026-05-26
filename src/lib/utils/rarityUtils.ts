import { Rarity } from "@/models/enums";

/**
 * Expands a rarity value into an array of concrete rarities.
 * Maps LEGENDARY_PLUS to [LEGENDARY, MYTHIC]; all others map to a single-element array.
 */
export function expandRarity(rarity: Rarity): Rarity[] {
    if (rarity === Rarity.LEGENDARY_PLUS) {
        return [Rarity.LEGENDARY, Rarity.MYTHIC];
    }
    return [rarity];
}
