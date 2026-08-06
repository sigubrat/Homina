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
import {
    renderSeasonByRarityMessage,
    type SeasonByRarityOptions,
} from "@/commands/guild-raid/seasonByRarity";
import {
    renderBestCompsMessage,
    type BestCompsOptions,
} from "@/commands/guild-raid/bestComps";
import {
    renderRelativePerformanceMessage,
    type RelativePerformanceOptions,
} from "@/commands/guild-raid/relativePerformance";
import { renderAchievementsMessage } from "@/commands/guild-raid/achievements";
import {
    renderSeasonTokensMessage,
    type SeasonTokensOptions,
} from "@/commands/guild-raid/seasonTokens";
import {
    renderMemberStatsBySeasonMessage,
    type MemberStatsBySeasonOptions,
} from "@/commands/guild-raid/memberStatsBySeason";
import { Rarity } from "@/models/enums";
import { getNextSeasonEnd } from "@/lib/utils/timeUtils";
import { UserError } from "@/models/errors/UserError";

/** Sentinel value for `intervalHours` indicating an end-of-season schedule. */
export const END_OF_SEASON_INTERVAL = 0;

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
 * Adds the `end-of-season` boolean option to a schedulable subcommand builder.
 * When set, the command runs once at each season end (Tue 10:00 UTC) instead of
 * on a fixed hourly interval.
 */
export function addEndOfSeasonOption(
    sc: SlashCommandSubcommandBuilder,
): SlashCommandSubcommandBuilder {
    return sc.addBooleanOption((opt) =>
        opt
            .setName("end-of-season")
            .setDescription(
                "Run once at each season end (Tue 10:00 UTC) instead of on a fixed interval",
            )
            .setRequired(false),
    );
}

/**
 * Parses the interval-related options from a schedulable command interaction.
 * If `end-of-season` is true, returns intervalHours=0 and startAt=next season end.
 * Otherwise requires `every-hours` to be provided.
 */
export function parseIntervalOptions(
    interaction: ChatInputCommandInteraction,
): { intervalHours: number; startAt: Date | null } {
    const endOfSeason =
        interaction.options.getBoolean("end-of-season") ?? false;
    const everyHours = interaction.options.getInteger("every-hours");

    if (endOfSeason && everyHours !== null) {
        throw new UserError(
            "You cannot combine `end-of-season` with `every-hours`. Pick one or the other.",
        );
    }

    if (endOfSeason) {
        if (interaction.options.getInteger("start-hour") !== null) {
            throw new UserError(
                "`start-hour` cannot be used with `end-of-season`. The run time is always Tuesday 10:00 UTC.",
            );
        }
        return {
            intervalHours: END_OF_SEASON_INTERVAL,
            startAt: getNextSeasonEnd(),
        };
    }

    if (everyHours === null || everyHours === undefined) {
        throw new UserError(
            "You must provide either `every-hours` or set `end-of-season` to true.",
        );
    }

    return {
        intervalHours: everyHours,
        startAt: resolveStartHourUtc(
            interaction.options.getInteger("start-hour"),
        ),
    };
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
            addEndOfSeasonOption(
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
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
                                .setMinValue(1)
                                .setMaxValue(168),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson: null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            return renderAvailabilityMessage(ctx.ownerUserId);
        },
    },
    {
        name: "season-participation",
        description: "Per-member participation/damage in season",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
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
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
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
                                    {
                                        name: "Legendary",
                                        value: Rarity.LEGENDARY,
                                    },
                                    { name: "Epic", value: Rarity.EPIC },
                                    { name: "Rare", value: Rarity.RARE },
                                    {
                                        name: "Uncommon",
                                        value: Rarity.UNCOMMON,
                                    },
                                    { name: "Common", value: Rarity.COMMON },
                                ),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            const opts: SeasonParticipationOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt,
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
    {
        name: "season-by-rarity",
        description: "Per-boss damage breakdown at a specific rarity",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
                addStartTimeOption(
                    sc
                        .setName("season-by-rarity")
                        .setDescription(
                            "Schedule periodic season-by-rarity posts",
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
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
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
                                    {
                                        name: "Legendary",
                                        value: Rarity.LEGENDARY,
                                    },
                                    { name: "Epic", value: Rarity.EPIC },
                                    { name: "Rare", value: Rarity.RARE },
                                    {
                                        name: "Uncommon",
                                        value: Rarity.UNCOMMON,
                                    },
                                    { name: "Common", value: Rarity.COMMON },
                                ),
                        )
                        .addStringOption((opt) =>
                            opt
                                .setName("boss-type")
                                .setDescription("Main bosses or primes")
                                .setRequired(false)
                                .addChoices(
                                    { name: "Main Boss", value: "main" },
                                    { name: "Prime", value: "prime" },
                                ),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            const opts: SeasonByRarityOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;
            const bossType = interaction.options.getString("boss-type");
            if (bossType) opts.bossType = bossType;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            const opts: SeasonByRarityOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderSeasonByRarityMessage(ctx.ownerUserId, opts);
        },
        formatOptions: (optionsJson) => {
            if (!optionsJson) return "";
            let opts: SeasonByRarityOptions;
            try {
                opts = JSON.parse(optionsJson);
            } catch {
                return "";
            }
            const parts: string[] = [];
            if (opts.rarity) parts.push(`rarity: ${opts.rarity}`);
            if (opts.bossType) parts.push(`type: ${opts.bossType}`);
            return parts.length > 0 ? `[${parts.join(", ")}]` : "";
        },
    },
    {
        name: "best-comps",
        description: "Highest scoring raid team compositions",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
                addStartTimeOption(
                    sc
                        .setName("best-comps")
                        .setDescription("Schedule periodic best-comps posts")
                        .addChannelOption((opt) =>
                            opt
                                .setName("channel")
                                .setDescription("The channel to post in")
                                .setRequired(true),
                        )
                        .addIntegerOption((opt) =>
                            opt
                                .setName("every-hours")
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
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
                                    {
                                        name: "Legendary",
                                        value: Rarity.LEGENDARY,
                                    },
                                    { name: "Epic", value: Rarity.EPIC },
                                    { name: "Rare", value: Rarity.RARE },
                                    {
                                        name: "Uncommon",
                                        value: Rarity.UNCOMMON,
                                    },
                                    { name: "Common", value: Rarity.COMMON },
                                ),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            const opts: BestCompsOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            const opts: BestCompsOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderBestCompsMessage(ctx.ownerUserId, opts);
        },
        formatOptions: (optionsJson) => {
            if (!optionsJson) return "";
            let opts: BestCompsOptions;
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
    {
        name: "relative-performance",
        description: "Member performance relative to guild average",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
                addStartTimeOption(
                    sc
                        .setName("relative-performance")
                        .setDescription(
                            "Schedule periodic relative-performance posts",
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
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
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
                                    {
                                        name: "Legendary",
                                        value: Rarity.LEGENDARY,
                                    },
                                    { name: "Epic", value: Rarity.EPIC },
                                    { name: "Rare", value: Rarity.RARE },
                                    {
                                        name: "Uncommon",
                                        value: Rarity.UNCOMMON,
                                    },
                                    { name: "Common", value: Rarity.COMMON },
                                ),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            const opts: RelativePerformanceOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            const opts: RelativePerformanceOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderRelativePerformanceMessage(ctx.ownerUserId, opts);
        },
        formatOptions: (optionsJson) => {
            if (!optionsJson) return "";
            let opts: RelativePerformanceOptions;
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
    {
        name: "season-achievements",
        description: "Fun guild-wide superlatives and awards",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
                addStartTimeOption(
                    sc
                        .setName("season-achievements")
                        .setDescription(
                            "Schedule periodic season achievements posts",
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
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
                                .setMinValue(1)
                                .setMaxValue(168),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson: null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            return renderAchievementsMessage(ctx.ownerUserId);
        },
    },
    {
        name: "season-tokens",
        description: "Token usage per member in a season",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
                addStartTimeOption(
                    sc
                        .setName("season-tokens")
                        .setDescription("Schedule periodic season tokens posts")
                        .addChannelOption((opt) =>
                            opt
                                .setName("channel")
                                .setDescription("The channel to post in")
                                .setRequired(true),
                        )
                        .addIntegerOption((opt) =>
                            opt
                                .setName("every-hours")
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
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
                                    {
                                        name: "Legendary",
                                        value: Rarity.LEGENDARY,
                                    },
                                    { name: "Epic", value: Rarity.EPIC },
                                    { name: "Rare", value: Rarity.RARE },
                                    {
                                        name: "Uncommon",
                                        value: Rarity.UNCOMMON,
                                    },
                                    { name: "Common", value: Rarity.COMMON },
                                ),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            const opts: SeasonTokensOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            const opts: SeasonTokensOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderSeasonTokensMessage(ctx.ownerUserId, opts);
        },
        formatOptions: (optionsJson) => {
            if (!optionsJson) return "";
            let opts: SeasonTokensOptions;
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
    {
        name: "member-stats-per-season",
        description: "Detailed per-member stats and team distributions",
        buildAddSubcommand: (sc) =>
            addEndOfSeasonOption(
                addStartTimeOption(
                    sc
                        .setName("member-stats-per-season")
                        .setDescription("Schedule periodic member stats posts")
                        .addChannelOption((opt) =>
                            opt
                                .setName("channel")
                                .setDescription("The channel to post in")
                                .setRequired(true),
                        )
                        .addIntegerOption((opt) =>
                            opt
                                .setName("every-hours")
                                .setDescription(
                                    "How often to post (in hours). Ignored if end-of-season is set.",
                                )
                                .setRequired(false)
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
                                    {
                                        name: "Legendary",
                                        value: Rarity.LEGENDARY,
                                    },
                                    { name: "Epic", value: Rarity.EPIC },
                                    { name: "Rare", value: Rarity.RARE },
                                    {
                                        name: "Uncommon",
                                        value: Rarity.UNCOMMON,
                                    },
                                    { name: "Common", value: Rarity.COMMON },
                                ),
                        ),
                ),
            ),
        parseAddOptions: (interaction) => {
            const { intervalHours, startAt } =
                parseIntervalOptions(interaction);
            const opts: MemberStatsBySeasonOptions = {};
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours,
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
                startAt,
            };
        },
        renderer: async (ctx) => {
            const opts: MemberStatsBySeasonOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderMemberStatsBySeasonMessage(ctx.ownerUserId, opts);
        },
        formatOptions: (optionsJson) => {
            if (!optionsJson) return "";
            let opts: MemberStatsBySeasonOptions;
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
