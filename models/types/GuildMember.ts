import type { Role } from "../enums";

export type GuildMember = {
    userId: string;
    role: Role;
    level: number;
    lastActivityOn?: Date;
};
