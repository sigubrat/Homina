import type { CampaignProgress } from "./CampaignProgress";
import type { Arena } from "./Arena";
import type { GuildRaid } from "./GuildRaid";
import type { Onslaught } from "./Onslaught";
import type { SalvageRun } from "./SalvageRun";

export interface Progress {
    campaigns: CampaignProgress[];
    arena?: Arena;
    guildRaid?: GuildRaid;
    onslaught?: Onslaught;
    salvageRun?: SalvageRun;
}
