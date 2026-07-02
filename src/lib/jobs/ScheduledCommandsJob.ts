import { Cron } from "croner";
import { TextChannel } from "discord.js";
import { dbController, logger } from "@/lib";
import { BotEventType } from "@/models/enums";
import { SCHEDULABLE_MAP } from "@/lib/scheduler/schedulableCommands";
import {
    SCHEDULER_TICK_CRON,
    SCHEDULE_RETRY_MINUTES,
} from "@/lib/configs/constants";
import { ExternalApiError } from "@/models/errors/ServiceError";
import type { Client } from "discord.js";

const CONCURRENCY_LIMIT = 3;

export class ScheduledCommandsJob {
    private client: Client;
    private job: Cron | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    async start(): Promise<void> {
        // Boot reconciliation: skip past any overdue schedules
        const reconciled = await dbController.reconcileOverdueSchedules();
        if (reconciled > 0) {
            logger.info(
                `Reconciled ${reconciled} overdue schedule(s) — re-anchored nextRunAt.`,
            );
            void dbController.logEvent(
                BotEventType.BOT_EVENT,
                "schedule-reconcile",
                {
                    count: reconciled,
                },
            );
        }

        this.job = new Cron(
            SCHEDULER_TICK_CRON,
            { timezone: "UTC", protect: true },
            () => {
                void this.tick();
            },
        );

        logger.info("Scheduled commands job started (tick every minute).");
    }

    stop(): void {
        this.job?.stop();
        this.job = null;
    }

    private async tick(): Promise<void> {
        try {
            const due = await dbController.getDueSchedules(50);
            if (due.length === 0) return;

            // Process in batches of CONCURRENCY_LIMIT
            for (let i = 0; i < due.length; i += CONCURRENCY_LIMIT) {
                const batch = due.slice(i, i + CONCURRENCY_LIMIT);
                await Promise.allSettled(batch.map((s) => this.runOne(s)));
            }
        } catch (error) {
            logger.error(error, "Scheduler tick error");
        }
    }

    private async runOne(schedule: any): Promise<void> {
        const {
            id,
            commandName,
            channelId,
            ownerUserId,
            optionsJson,
            intervalHours,
        } = schedule;

        const entry = SCHEDULABLE_MAP.get(commandName);
        if (!entry) {
            logger.warn(
                `Schedulable command "${commandName}" not found in registry (schedule #${id})`,
            );
            await dbController.pauseSchedule(id, "command_removed");
            return;
        }

        // Verify channel access
        let channel: TextChannel;
        try {
            const fetched = await this.client.channels.fetch(channelId);
            if (!fetched || !(fetched instanceof TextChannel)) {
                await this.pauseAndNotify(
                    id,
                    ownerUserId,
                    "channel_unavailable",
                    commandName,
                );
                return;
            }
            channel = fetched;
        } catch {
            await this.pauseAndNotify(
                id,
                ownerUserId,
                "channel_unavailable",
                commandName,
            );
            return;
        }

        // Verify owner still has a valid token
        const token = await dbController.getUserToken(ownerUserId);
        if (!token) {
            await this.pauseAndNotify(
                id,
                ownerUserId,
                "token_invalid",
                commandName,
            );
            return;
        }

        // Execute the renderer
        try {
            const payload = await entry.renderer({ ownerUserId, optionsJson });
            await channel.send(payload);

            // Success
            const nextRunAt = new Date(
                Date.now() + intervalHours * 60 * 60 * 1000,
            );
            await dbController.updateSchedule(id, {
                lastRunAt: new Date(),
                nextRunAt,
                lastStatus: "ok",
                lastError: null,
            });

            void dbController.logEvent(
                BotEventType.BOT_EVENT,
                "scheduled-command-run",
                {
                    scheduleId: id,
                    commandName,
                    channelId,
                    status: "ok",
                },
            );
        } catch (error) {
            await this.handleRunError(
                id,
                intervalHours,
                commandName,
                ownerUserId,
                error,
            );
        }
    }

    private async handleRunError(
        id: number,
        intervalHours: number,
        commandName: string,
        ownerUserId: string,
        error: unknown,
    ): Promise<void> {
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        if (error instanceof ExternalApiError) {
            const status = (error as any).context?.status as number | undefined;
            if (status === 403) {
                await this.pauseAndNotify(
                    id,
                    ownerUserId,
                    "token_invalid",
                    commandName,
                );
                return;
            }
            // Transient API error — retry sooner
            const nextRunAt = new Date(
                Date.now() + SCHEDULE_RETRY_MINUTES * 60 * 1000,
            );
            await dbController.updateSchedule(id, {
                lastRunAt: new Date(),
                nextRunAt,
                lastStatus: "error",
                lastError: errorMessage.slice(0, 255),
            });
        } else {
            // Non-transient or unknown error — normal reschedule
            const nextRunAt = new Date(
                Date.now() + intervalHours * 60 * 60 * 1000,
            );
            await dbController.updateSchedule(id, {
                lastRunAt: new Date(),
                nextRunAt,
                lastStatus: "error",
                lastError: errorMessage.slice(0, 255),
            });
        }

        logger.error(
            error,
            `Scheduled command run failed (schedule #${id}, command: ${commandName})`,
        );
        void dbController.logEvent(
            BotEventType.BOT_EVENT,
            "scheduled-command-run",
            {
                scheduleId: id,
                commandName,
                status: "error",
                error: errorMessage.slice(0, 255),
            },
        );
    }

    private async pauseAndNotify(
        id: number,
        ownerUserId: string,
        reason: string,
        commandName: string,
    ): Promise<void> {
        await dbController.pauseSchedule(id, reason);

        const reasonText =
            reason === "token_invalid"
                ? "your API token is no longer valid"
                : reason === "channel_unavailable"
                  ? "the target channel is no longer accessible"
                  : reason;

        try {
            const user = await this.client.users.fetch(ownerUserId);
            await user.send(
                `⚠️ Your scheduled **/${commandName}** (ID #${id}) has been paused because ${reasonText}. Use \`/schedule resume\` after fixing the issue.`,
            );
        } catch {
            logger.warn(
                `Could not DM user ${ownerUserId} about paused schedule #${id}`,
            );
        }

        logger.info(`Paused schedule #${id} (reason: ${reason})`);
        void dbController.logEvent(
            BotEventType.BOT_EVENT,
            "scheduled-command-paused",
            {
                scheduleId: id,
                commandName,
                reason,
            },
        );
    }
}
