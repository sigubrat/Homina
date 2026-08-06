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
import { isGuildRaidOffSeason, getNextSeasonEnd } from "@/lib/utils/timeUtils";
import { END_OF_SEASON_INTERVAL } from "@/lib/scheduler/schedulableCommands";
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
            const offSeason = isGuildRaidOffSeason();
            const due = await dbController.getDueSchedules(50);
            if (due.length === 0) return;

            // During off-season, only run end-of-season schedules
            const eligible = offSeason
                ? due.filter(
                      (s: any) => s.intervalHours === END_OF_SEASON_INTERVAL,
                  )
                : due;
            if (eligible.length === 0) return;

            // Process in batches of CONCURRENCY_LIMIT
            for (let i = 0; i < eligible.length; i += CONCURRENCY_LIMIT) {
                const batch = eligible.slice(i, i + CONCURRENCY_LIMIT);
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
                `Schedulable command "${commandName}" not found in registry (schedule #${id}) — deleting.`,
            );
            await dbController.deleteScheduleById(id);
            return;
        }

        // Verify channel access
        let channel: TextChannel;
        try {
            const fetched = await this.client.channels.fetch(channelId);
            if (!fetched || !(fetched instanceof TextChannel)) {
                await this.rescheduleWithError(
                    id,
                    intervalHours,
                    "channel_unavailable",
                    schedule.nextRunAt,
                );
                return;
            }
            channel = fetched;
        } catch {
            await this.rescheduleWithError(
                id,
                intervalHours,
                "channel_unavailable",
                schedule.nextRunAt,
            );
            return;
        }

        // Verify owner still has a valid token
        const token = await dbController.getUserToken(ownerUserId);
        if (!token) {
            await this.pauseAndNotifyTokenInvalid(id, commandName, ownerUserId);
            return;
        }

        // Execute the renderer
        try {
            const payload = await entry.renderer({ ownerUserId, optionsJson });
            await channel.send(payload);

            // Success — anchor to the intended time, not wall-clock, to prevent drift
            let nextRunAt: Date;
            if (intervalHours === END_OF_SEASON_INTERVAL) {
                nextRunAt = getNextSeasonEnd();
            } else {
                const intervalMs = intervalHours * 60 * 60 * 1000;
                nextRunAt = new Date(schedule.nextRunAt.getTime() + intervalMs);
                // If the anchored time is already in the past (e.g. long execution), advance to next future slot
                while (nextRunAt.getTime() <= Date.now()) {
                    nextRunAt = new Date(nextRunAt.getTime() + intervalMs);
                }
            }
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
                schedule.nextRunAt,
            );
        }
    }

    private async handleRunError(
        id: number,
        intervalHours: number,
        commandName: string,
        ownerUserId: string,
        error: unknown,
        anchorTime: Date,
    ): Promise<void> {
        const errorMessage =
            error instanceof Error ? error.message : String(error);

        if (
            error instanceof ExternalApiError &&
            ((error as any).context?.status as number | undefined) === 403
        ) {
            await this.pauseAndNotifyTokenInvalid(id, commandName, ownerUserId);
            return;
        }

        const retrySoon = error instanceof ExternalApiError;
        let nextRunAt: Date;
        if (retrySoon) {
            nextRunAt = new Date(
                Date.now() + SCHEDULE_RETRY_MINUTES * 60 * 1000,
            );
        } else if (intervalHours === END_OF_SEASON_INTERVAL) {
            nextRunAt = getNextSeasonEnd();
        } else {
            const intervalMs = intervalHours * 60 * 60 * 1000;
            nextRunAt = new Date(anchorTime.getTime() + intervalMs);
            while (nextRunAt.getTime() <= Date.now()) {
                nextRunAt = new Date(nextRunAt.getTime() + intervalMs);
            }
        }

        await dbController.updateSchedule(id, {
            lastRunAt: new Date(),
            nextRunAt,
            lastStatus: "error",
            lastError: errorMessage.slice(0, 255),
        });

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

    private async pauseAndNotifyTokenInvalid(
        id: number,
        commandName: string,
        ownerUserId: string,
    ): Promise<void> {
        await dbController.pauseSchedule(id, "token_invalid");

        try {
            const user = await this.client.users.fetch(ownerUserId);
            await user.send(
                `⚠️ Your scheduled **/${commandName}** has been paused because your API token is no longer valid. ` +
                    `Update your token with \`/register\`, then run \`/schedule update-token\` to resume your schedules.`,
            );
        } catch {
            logger.warn(
                `Could not DM user ${ownerUserId} about paused schedule #${id}`,
            );
        }

        logger.info(`Paused schedule #${id} (reason: token_invalid)`);
        void dbController.logEvent(
            BotEventType.BOT_EVENT,
            "scheduled-command-paused",
            {
                scheduleId: id,
                commandName,
                reason: "token_invalid",
            },
        );
    }

    private async rescheduleWithError(
        id: number,
        intervalHours: number,
        reason: string,
        anchorTime?: Date,
    ): Promise<void> {
        let nextRunAt: Date;
        if (intervalHours === END_OF_SEASON_INTERVAL) {
            nextRunAt = getNextSeasonEnd();
        } else if (anchorTime) {
            const intervalMs = intervalHours * 60 * 60 * 1000;
            nextRunAt = new Date(anchorTime.getTime() + intervalMs);
            while (nextRunAt.getTime() <= Date.now()) {
                nextRunAt = new Date(nextRunAt.getTime() + intervalMs);
            }
        } else {
            nextRunAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
        }
        await dbController.updateSchedule(id, {
            lastRunAt: new Date(),
            nextRunAt,
            lastStatus: "error",
            lastError: reason,
        });
        logger.warn(
            `Scheduled command run skipped (schedule #${id}, reason: ${reason})`,
        );
        void dbController.logEvent(
            BotEventType.BOT_EVENT,
            "scheduled-command-run",
            {
                scheduleId: id,
                status: "error",
                error: reason,
            },
        );
    }
}
