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
import { MINIMUM_SEASON_THRESHOLD } from "@/lib/configs/constants";

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
    };
    renderer: (
        ctx: ScheduledContext,
    ) => Promise<{ embeds: EmbedBuilder[]; files?: AttachmentBuilder[] }>;
}

export const SCHEDULABLE: SchedulableEntry[] = [
    {
        name: "gr-availability",
        description: "Token and bomb availability overview",
        buildAddSubcommand: (sc) =>
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
        parseAddOptions: (interaction) => ({
            channelId: interaction.options.getChannel("channel", true).id,
            intervalHours: interaction.options.getInteger("every-hours", true),
            optionsJson: null,
        }),
        renderer: async (ctx) => {
            return renderAvailabilityMessage(ctx.ownerUserId);
        },
    },
    {
        name: "season-participation",
        description: "Per-member participation/damage in season",
        buildAddSubcommand: (sc) =>
            sc
                .setName("season-participation")
                .setDescription("Schedule periodic season participation posts")
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
                .addNumberOption((opt) =>
                    opt
                        .setName("season")
                        .setDescription("Season number (defaults to current)")
                        .setRequired(false)
                        .setMinValue(MINIMUM_SEASON_THRESHOLD),
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
                )
                .addStringOption((opt) =>
                    opt
                        .setName("average-method")
                        .setDescription("Mean or median for damage averaging")
                        .setRequired(false)
                        .addChoices(
                            { name: "Mean", value: "mean" },
                            { name: "Median", value: "median" },
                        ),
                ),
        parseAddOptions: (interaction) => {
            const opts: SeasonParticipationOptions = {};
            const season = interaction.options.getNumber("season");
            if (season != null) opts.season = season;
            const rarity = interaction.options.getString("rarity");
            if (rarity) opts.rarity = rarity;
            const averageMethod = interaction.options.getString(
                "average-method",
            ) as "mean" | "median" | null;
            if (averageMethod) opts.averageMethod = averageMethod;

            return {
                channelId: interaction.options.getChannel("channel", true).id,
                intervalHours: interaction.options.getInteger(
                    "every-hours",
                    true,
                ),
                optionsJson:
                    Object.keys(opts).length > 0 ? JSON.stringify(opts) : null,
            };
        },
        renderer: async (ctx) => {
            const opts: SeasonParticipationOptions = ctx.optionsJson
                ? JSON.parse(ctx.optionsJson)
                : {};
            return renderSeasonParticipationMessage(ctx.ownerUserId, opts);
        },
    },
];

export const SCHEDULABLE_MAP = new Map(SCHEDULABLE.map((e) => [e.name, e]));
