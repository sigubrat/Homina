import { Client, Collection } from "discord.js";
import type { Command } from "./Command";

export class IClient extends Client {
    commands = new Collection<string, Command>();
    cooldowns = new Collection<string, Collection<string, number>>();
}
