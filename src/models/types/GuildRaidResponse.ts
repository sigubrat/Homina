import type { Raid } from "./Raid";

export interface GuildRaidResponse {
    season: number;
    seasonConfigId: string;
    entries: Raid[];
}
