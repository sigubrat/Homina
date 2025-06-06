import type { Inventory } from "./Inventory";
import type { PlayerDetails } from "./PlayerDetails";
import type { Progress } from "./Progress";
import type { Unit } from "./Unit";

export interface Player {
    details: PlayerDetails;
    units: Unit[];
    inventory: Inventory;
    progress: Progress;
}
