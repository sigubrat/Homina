import type { GuildMember } from "./GuildMember";

export interface Guild {
    guildId: string;
    guildTag: string;
    name: string;
    level: number;
    members: GuildMember[];
    guildRaidSeasons: number[];
}
