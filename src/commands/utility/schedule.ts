import {
    ActionRowBuilder,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder,
    MessageFlags,
    PermissionsBitField,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    TextChannel,
} from "discord.js";
import { dbController, logger } from "@/lib";
import { handleCommandError } from "@/lib/utils/errorUtils";
import { resolveGuildId } from "@/lib/utils/guildMemberUtils";
import { HominaTacticusClient } from "@/client";
import {
    SCHEDULABLE,
    SCHEDULABLE_MAP,
} from "@/lib/scheduler/schedulableCommands";
import {
    MAX_SCHEDULES_PER_GUILD,
    MIN_SCHEDULE_INTERVAL_HOURS,
    MAX_SCHEDULE_INTERVAL_HOURS,
} from "@/lib/configs/constants";
import { UserError } from "@/models/errors/UserError";

export const cooldown = 3;

const builder = new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Manage scheduled automatic command posts");
// TODO: Re-enable for production
// .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// Dynamically add schedulable command subcommands (e.g. /schedule gr-availability)
for (const entry of SCHEDULABLE) {
    builder.addSubcommand((sc) =>
        entry.buildAddSubcommand(sc as SlashCommandSubcommandBuilder),
    );
}

builder
    .addSubcommand((sc) =>
        sc
            .setName("list")
            .setDescription("List all active schedules for this server"),
    )
    .addSubcommand((sc) =>
        sc
            .setName("remove")
            .setDescription("Remove a scheduled command")
            .addStringOption((opt) =>
                opt
                    .setName("schedule")
                    .setDescription("The schedule to remove")
                    .setRequired(true)
                    .setAutocomplete(true),
            ),
    )
    .addSubcommand((sc) =>
        sc
            .setName("test")
            .setDescription(
                "Immediately trigger all your scheduled commands in this server",
            ),
    );

export const data = builder;

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const subcommand = interaction.options.getSubcommand();

        // Resolve the invoker's Tacticus guild for scoping
        const client = interaction.client as unknown as HominaTacticusClient;
        const guildId = await resolveGuildId(
            interaction.user.id,
            client,
            dbController,
        );

        if (SCHEDULABLE_MAP.has(subcommand)) {
            await handleAdd(interaction, subcommand, guildId);
        } else if (subcommand === "list") {
            await handleList(interaction, guildId);
        } else if (subcommand === "remove") {
            await handleRemove(interaction, guildId);
        } else if (subcommand === "test") {
            await handleTest(interaction, guildId);
        }
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}

async function handleAdd(
    interaction: ChatInputCommandInteraction,
    commandName: string,
    guildId: string,
) {
    const entry = SCHEDULABLE_MAP.get(commandName);
    if (!entry) {
        throw new UserError(`Unknown schedulable command: ${commandName}`);
    }

    const discordGuildId = interaction.guildId;
    if (!discordGuildId) {
        throw new UserError("This command can only be used in a server.");
    }

    // Check bot permissions in target channel
    const parsed = entry.parseAddOptions(interaction);
    const channel = await interaction.guild!.channels.fetch(parsed.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
        throw new UserError(
            "The specified channel is not a text channel or could not be found.",
        );
    }

    const botMember = await interaction.guild!.members.fetchMe();
    const botPerms = channel.permissionsFor(botMember);
    if (
        !botPerms?.has(PermissionsBitField.Flags.ViewChannel) ||
        !botPerms?.has(PermissionsBitField.Flags.SendMessages) ||
        !botPerms?.has(PermissionsBitField.Flags.EmbedLinks)
    ) {
        throw new UserError(
            "I need **View Channel**, **Send Messages**, and **Embed Links** permissions in the target channel.",
        );
    }

    // Validate interval
    if (
        parsed.intervalHours < MIN_SCHEDULE_INTERVAL_HOURS ||
        parsed.intervalHours > MAX_SCHEDULE_INTERVAL_HOURS
    ) {
        throw new UserError(
            `Interval must be between ${MIN_SCHEDULE_INTERVAL_HOURS} and ${MAX_SCHEDULE_INTERVAL_HOURS} hours.`,
        );
    }

    // Enforce per-guild cap
    const currentCount = await dbController.getScheduleCountByDiscordGuild(
        discordGuildId,
        guildId,
    );
    if (currentCount >= MAX_SCHEDULES_PER_GUILD) {
        throw new UserError(
            `Your guild already has ${MAX_SCHEDULES_PER_GUILD} scheduled commands (the maximum). Remove one before adding another.`,
        );
    }

    // Create or update the schedule
    const nextRunAt = new Date(
        Date.now() + parsed.intervalHours * 60 * 60 * 1000,
    );

    // Check if a schedule already exists for this command+channel in this game guild
    const existingSchedules = await dbController.listSchedulesByDiscordGuild(
        discordGuildId,
        guildId,
    );
    const existing = existingSchedules.find(
        (s: any) =>
            s.channelId === parsed.channelId &&
            s.commandName === commandName &&
            s.guildId === guildId,
    );

    if (existing) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("schedule_override_confirm")
                .setLabel("Override")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("schedule_override_cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger),
        );

        const currentOwner =
            existing.ownerUserId === interaction.user.id
                ? "you"
                : `<@${existing.ownerUserId}>`;

        await interaction.editReply({
            content: `⚠️ **/${commandName}** is already scheduled in <#${parsed.channelId}> (every **${existing.intervalHours}h**, owned by ${currentOwner}).\nOverride it with your new interval of **${parsed.intervalHours}h**?`,
            components: [row],
        });

        try {
            const response = await interaction.fetchReply();
            const confirmation = await response.awaitMessageComponent({
                componentType: ComponentType.Button,
                filter: (i) => i.user.id === interaction.user.id,
                time: 30_000,
            });

            if (confirmation.customId === "schedule_override_confirm") {
                await dbController.updateSchedule(existing.id, {
                    intervalHours: parsed.intervalHours,
                    optionsJson: parsed.optionsJson,
                    ownerUserId: interaction.user.id,
                    nextRunAt,
                    pausedReason: null,
                    lastStatus: null,
                    lastError: null,
                });

                await confirmation.update({
                    content: `🔄 Updated schedule **#${existing.id}** for **/${commandName}** in <#${parsed.channelId}> — now every **${parsed.intervalHours}h**. Next post: <t:${Math.floor(nextRunAt.getTime() / 1000)}:R>`,
                    components: [],
                });
            } else {
                await confirmation.update({
                    content: "❌ Cancelled — existing schedule unchanged.",
                    components: [],
                });
                return;
            }
        } catch {
            await interaction.editReply({
                content: "⏱️ Timed out — existing schedule unchanged.",
                components: [],
            });
            return;
        }
    } else {
        await dbController.createSchedule({
            guildId,
            discordGuildId,
            channelId: parsed.channelId,
            commandName,
            optionsJson: parsed.optionsJson,
            intervalHours: parsed.intervalHours,
            ownerUserId: interaction.user.id,
            nextRunAt,
        });

        await interaction.editReply({
            content: `✅ Scheduled **/${commandName}** to run in <#${parsed.channelId}> every **${parsed.intervalHours}h**. First post: <t:${Math.floor(nextRunAt.getTime() / 1000)}:R>`,
        });
    }

    logger.info(
        `${interaction.user.username} scheduled ${commandName} every ${parsed.intervalHours}h in channel ${parsed.channelId}`,
    );
}

async function handleList(
    interaction: ChatInputCommandInteraction,
    guildId: string,
) {
    const discordGuildId = interaction.guildId;
    if (!discordGuildId) {
        throw new UserError("This command can only be used in a server.");
    }

    const schedules = await dbController.listSchedulesByDiscordGuild(
        discordGuildId,
        guildId,
    );

    if (schedules.length === 0) {
        await interaction.editReply({
            content: "No scheduled commands for this server.",
        });
        return;
    }

    const lines = schedules.map((s: any) => {
        const status = s.pausedReason
            ? `⏸️ paused (${s.pausedReason})`
            : "✅ active";
        const nextRun = s.pausedReason
            ? "—"
            : `<t:${Math.floor(new Date(s.nextRunAt).getTime() / 1000)}:R>`;
        return `**#${s.id}** \`/${s.commandName}\` → <#${s.channelId}> every **${s.intervalHours}h** | ${status} | next: ${nextRun}`;
    });

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Scheduled Commands")
        .setDescription(lines.join("\n"));

    await interaction.editReply({ embeds: [embed] });
}

async function handleRemove(
    interaction: ChatInputCommandInteraction,
    guildId: string,
) {
    const discordGuildId = interaction.guildId;
    if (!discordGuildId) {
        throw new UserError("This command can only be used in a server.");
    }

    const id = parseInt(interaction.options.getString("schedule", true), 10);
    if (isNaN(id)) {
        throw new UserError("Invalid schedule selection.");
    }
    const deleted = await dbController.deleteSchedule(
        id,
        discordGuildId,
        guildId,
    );

    if (!deleted) {
        throw new UserError(
            `No schedule with ID **${id}** found in this server.`,
        );
    }

    await interaction.editReply({ content: `🗑️ Schedule **#${id}** removed.` });
}

async function handleTest(
    interaction: ChatInputCommandInteraction,
    guildId: string,
) {
    const discordGuildId = interaction.guildId;
    if (!discordGuildId) {
        throw new UserError("This command can only be used in a server.");
    }

    const schedules = await dbController.listSchedulesByDiscordGuild(
        discordGuildId,
        guildId,
    );
    const userSchedules = schedules.filter(
        (s: any) => s.ownerUserId === interaction.user.id && !s.pausedReason,
    );

    if (userSchedules.length === 0) {
        throw new UserError(
            "You have no active schedules in this server to test.",
        );
    }

    // Set nextRunAt to now for all of the user's active schedules — the scheduler tick will pick them up within a minute
    for (const s of userSchedules) {
        await dbController.updateSchedule(s.id, { nextRunAt: new Date() });
    }

    await interaction.editReply({
        content: `⚡ Triggered **${userSchedules.length}** schedule(s). They will fire within the next minute.`,
    });
}

export async function autocomplete(interaction: AutocompleteInteraction) {
    const discordGuildId = interaction.guildId;
    if (!discordGuildId) return;

    const focused = interaction.options.getFocused().toLowerCase();

    try {
        // Resolve invoker's guild to scope results
        const guildId = await dbController.getGuildIdByUserId(
            interaction.user.id,
        );
        if (!guildId) {
            await interaction.respond([]);
            return;
        }

        const schedules = await dbController.listSchedulesByDiscordGuild(
            discordGuildId,
            guildId,
        );

        const choices = await Promise.all(
            schedules
                .filter((s: any) => {
                    const label = `/${s.commandName} ${s.channelId} every ${s.intervalHours}h`;
                    return label.toLowerCase().includes(focused);
                })
                .slice(0, 25)
                .map(async (s: any) => {
                    const status = s.pausedReason ? " (paused)" : "";
                    let channelName = s.channelId;
                    try {
                        const ch = await interaction.guild?.channels.fetch(
                            s.channelId,
                        );
                        if (ch) channelName = ch.name;
                    } catch (error) {
                        logger.warn(
                            `Failed to fetch channel ${s.channelId} for autocomplete: ${error}`,
                        );
                    }
                    return {
                        name: `/${s.commandName} → #${channelName} every ${s.intervalHours}h${status}`,
                        value: String(s.id),
                    };
                }),
        );

        await interaction.respond(choices);
    } catch {
        await interaction.respond([]);
    }
}
