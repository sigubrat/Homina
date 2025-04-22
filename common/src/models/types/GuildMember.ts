import { Role } from "../enums";

export interface GuildMember {
    userId: string;
    role: Role;
    level: number;
    lastActivityOn?: Date;
}
