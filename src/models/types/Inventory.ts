import type { Item } from "./Item";
import type { Upgrade } from "./Upgrade";
import type { Shard } from "./Shard";
import type { XpBook } from "./XpBook";
import type { Component } from "./Component";
import type { ForgeBadge } from "./ForgeBadge";
import type { RequisitionOrders } from "./RequisitionOrders";

export interface Inventory {
    items: Item[];
    upgrades: Upgrade[];
    shards: Shard[];
    xpBooks: XpBook[];
    abilityBadges: Record<string, any[]>;
    components: Component[];
    forgeBadges: ForgeBadge[];
    orbs: Record<string, any[]>;
    requisitionOrders?: RequisitionOrders;
    resetStones: number;
}
