import type { UnitItem } from "./UnitItem";

export interface Unit {
    id: string; // e.g., "ultraEliminatorSgt"
    name?: string; // e.g., "Certus"
    faction?: string; // e.g., "Ultramarines"
    grandAlliance?: "Imperial" | "Chaos" | "Xenos"; // Enum: Array [3], example: "Imperial"
    progressionIndex: number; // 0-15, e.g., 5 (Star level: 0=Common, 3=Uncommon, 6=Rare, 9=Epic, 12=Legendary)
    xp: number; // total XP gained, e.g., 4552
    xpLevel: number; // 1-50, e.g., 6
    rank: number; // 0-17, e.g., 10 (0=Stone I, 3=Iron I, 6=Bronze I, 9=Silver I, 12=Gold I, 15=Diamond I, 17=Diamond III)
    abilities: any[]; // Define a proper type if available
    upgrades: number[][]; // 2*3 matrix, e.g., [[0,4],[...]]
    items: UnitItem[]; // equipped items, define UnitItem interface elsewhere
    shards: number; // e.g., 100
}
