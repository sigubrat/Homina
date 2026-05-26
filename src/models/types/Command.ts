import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";

export interface Command {
    data: SlashCommandBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
    cooldown?: number;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
