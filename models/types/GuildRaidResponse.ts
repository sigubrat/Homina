import type { GuildMember } from "./GuildMember";

export type GuildRaidResponse = {
    guildId: string;
    guildTag: string;
    name: string;
    level: number;
    members: GuildMember[];
    guildRaidSeasons: number[];
};
