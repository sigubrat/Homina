import { Cron } from "croner";
import { dbController, logger } from "@/lib";
import { BotEventType } from "@/models/enums";
import { MessageService } from "../services/MessageService";
import type { Client } from "discord.js";

const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

export class CleanupJob {
    private client: Client;
    private job: Cron | null = null;

    constructor(client: Client) {
        this.client = client;
    }

    /**
     * Starts the scheduled cleanup job.
     * Runs daily at 03:00 UTC and once immediately on startup.
     */
    start(): void {
        // Run once on startup
        void this.execute();

        // Schedule daily at 03:00 UTC
        this.job = new Cron("0 3 * * *", { timezone: "UTC" }, () => {
            void this.execute();
        });

        logger.info("Cleanup job scheduled (daily at 03:00 UTC).");
    }

    stop(): void {
        this.job?.stop();
        this.job = null;
    }

    private async execute(): Promise<void> {
        try {
            await this.runCleanup();
        } catch (error) {
            logger.error(error, "Cleanup failed, retrying in 5 minutes...");
            setTimeout(() => {
                void this.runCleanup().catch((retryError) => {
                    logger.error(retryError, "Cleanup retry also failed.");
                });
            }, RETRY_DELAY_MS);
        }
    }

    private async runCleanup(): Promise<void> {
        logger.info("Running token cleanup...");

        const deletedIds = await dbController.cleanupOldTokens();

        if (deletedIds.length > 0) {
            const messageService = new MessageService(this.client);
            for (const userId of deletedIds) {
                void dbController.logEvent(
                    BotEventType.USER_CLEANUP,
                    "token-cleanup",
                    { userId },
                );
                await messageService.alertDeletedUser(userId);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }

        // Clean up old player metadata (keep 30 days)
        await dbController.cleanupOldPlayerMetadata(30);

        // Clean up old bot events (keep 90 days)
        await dbController.cleanupOldEvents(90);

        logger.info("Token cleanup completed successfully.");

        void dbController.logEvent(BotEventType.BOT_EVENT, "cleanup-success", {
            deletedUsers: deletedIds.length,
        });
    }
}
