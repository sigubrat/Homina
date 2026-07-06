import type {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    SlashCommandSubcommandBuilder,
} from "discord.js";
import { renderAvailabilityMessage } from "@/commands/guild-raid/guildRaidAvailability";
import {
    renderSeasonParticipationMessage,
    type SeasonParticipationOptions,
} from "@/commands/guild-raid/seasonParticipation";
import { Rarity } from "@/models/enums";

export interface ScheduledContext {
    ownerUserId: string;
    optionsJson: string | null;
}

export interface SchedulableEntry {
    name: string;
    description: string;
    buildAddSubcommand: (
        sc: SlashCommandSubcommandBuilder,
    ) => SlashCommandSubcommandBuilder;
    parseAddOptions: (interaction: ChatInputCommandInteraction) => {
        channelId: string;
        intervalHours: number;
        optionsJson: string | null;
        startAt: Date | null;
    };
    renderer: (
        ctx: ScheduledContext,
    ) => Promise<{ embeds: EmbedBuilder[]; files?: AttachmentBuilder[] }>;
    /**
     * Optional short human-readable summary of the schedule's options,
     * used to distinguish multiple schedules of the same command in
     * list/autocomplete/override UI. Returns empty string when no options.
     */
    formatOptions?: (optionsJson: string | null) => string;
}

/**
 * Resolves a chosen UTC hour-of-day (0-23) into the next occurrence of that
 * hour on the wall clock, at :00:00.000. Returns null when no hour was chosen.
 * If the chosen hour has already passed today (UTC), rolls to tomorrow so the
 * returned Date is always strictly in the future.
 */
export function resolveStartHourUtc(hour: number | null): Date | null {
    if (hour === null) return null;
    const now = new Date();
    const candidate = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            hour,
            0,
            0,
            0,
        ),
    );
    if (candidate.getTime() <= now.getTime()) {
        candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    return candidate;
}

/**
 * Adds the `start-hour` option to a schedulable subcommand builder.
 * Shared so every schedulable command accepts the same input format:
 * a UTC hour-of-day (00:00 UTC through 23:00 UTC).
 */
export function addStartTimeOption(
    sc: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
    return sc.addIntegerOption((opt) => {
        opt.setName("start-hour")
            .setDescription(
                "Hour of day (UTC) for the first run. Defaults to now + interval.",
            )
            .setRequired(false);
        for (let h = 0; h < 24; h++) {
            const label = `${String(h).padStart(2, "0")}:00 UTC`;
            opt.addChoices({ name: label, value: h });
        }
        return opt;
    });
}

/**
 * Deep-sort object keys and drop nullish values so that two option sets
 * with the same content but different key order compare equal.
 */
export function normalizeOptionsJson(json: string | null): string | null {
    if (!json) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return json;
    }
    const normalized = normalizeValue(parsed);
    if (
        normalized === null ||
        (typeof normalized === "object" &&
            !Array.isArray(normalized) &&
            Object.keys(normalized as object).length === 0)
    ) {
        return null;
    }
    return JSON.stringify(normalized);
}

function normalizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => [k, normalizeValue(v)] as const)
            .sort(([a], [b]) => a.localeCompare(b));
        return Object.fromEntries(entries);
    }
    return value;
}

export const SCHEDULABLE: SchedulableEntry[] = [
    {
        name: "gr-availability",
        description: "Token and bomb availability overview",
        buildAddSubcommand: (sc) =>
            addStartTimeOption(
                sc
                    .setName("gr-availability")
                    .setDescription(
                        "Schedule periodic token/bomb availability posts",
                    )
                    .addChannelOption((opt) =>
                        opt
                            .setName("channel")
                            .setDescription("The channel to post in")
                            .setRequired(true),
                    )
                    .addIntegerOption((opt) =>
                        opt
                            .setName("every-hours")
                            .setDescription("How often to post (in hours)")
                            .setRequired(true)
                            .setMinValue(1)
                            .setMaxValue(168),
                    ),
            ),
        parseAddOptions: (interaction) => ({
            channelId: interaction.options.getChannel("channel", true).id,
            intervalHours: interaction.options.getInteger("every-hours", true),
            optionsJson: null,
            startAt: resolveStartHourUtc(
                interaction.options.getInteger("start-hour"),
            ),
        }),
        renderer: async (ctx) => {
            return renderAvailabilityMessage(ctx.ownerUserId);
        },
    },
    {
        name: "season-participation",
        description: "Per-member participation/damage in season",
        buildAddSubcommand: (sc) =>
            addStartTimeOption(
                sc
                    .setName("season-participation")
                    .setDescription(
                        "Schedule periodic season participation posts",
                    )
                    .addChannelOption((opt) =>
                        opt
                            .setName("channel")
                            .setDescription("The channel to post in")
                            .setRequired(true),
                    )
                    .addIntegerOption((opt) =>
                        opt
                            .setName("every-hours")
                            .setDescription("How often to post (in hours)")
                            .setRequired(true)
                            .setMinValue(1)
                            .setMaxValue(168),
                    )
                    .addStringOption((opt) =>
                        opt
                            .setName("rarity")
                            .setDescription("Boss rarity filter")
                            .setRequired(false)
                            .addChoices(
                                {
                                    name: "Legendary+",
                                    value: Rarity.LEGENDARY_PLUS,
                                },
                                { name: "Mythic", value: Rarity.MYTHIC },
                                { name: "Legendary", value: Rarity.LEGENDARY },
                                { name: "Epic", value: Rarity.EPIC },
                                { name: "Rare", value: Rarity.RARE },
                                { name: "Uncommon", value: Rarity.UNCOMMON },
                                { name: "Common", value: Rarity.COMMON },
                            ),
                    ),
            ),
        parseAddOptions: (interaction) => {
            const opts: SeasonParticipationOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours: interaction.options.getInteger(
                    "every-hours",
                    true,
                ),
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt: resolveStartHourUtc(
                    interaction.options.getInteger("start-hour"),
                ),
            };
        },
        renderer: async (ctx) => {
            const opts: SeasonParticipationOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderSeasonParticipationMessage(ctx.ownerUserId, opts);
        },
        formatOptions: (optionsJson) => {
            if (!optionsJson) return "";
            let opts: SeasonParticipationOptions;
            try {
                opts = JSON.parse(optionsJson);
            } catch {
                return "";
            }
            const parts: string[] = [];
            if (opts.rarity) parts.push(`rarity: ${opts.rarity}`);
            return parts.length > 0 ? `[${parts.join(", ")}]` : "";
        },
    },
];

export const SCHEDULABLE_MAP = new Map(SCHEDULABLE.map((e) => [e.name, e]));
