import { Client } from "discord.js";
import { logger } from "@/lib";

export class MessageService {
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    public async alertDeletedUser(userId: string): Promise<void> {
        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                logger.warn(`Could not find user with ID: ${userId}`);
                return;
            }

            await user.send({
                content:
                    "Hi! To preserve your right to privacy we have deleted your registration with Homina due to inactivity (30 days without use).\n\n" +
                    "If you would like to continue using the bot, please re-register using the `/register` command.\n\n" +
                    "If you have any questions or need assistance, please contact us at the Homina support server which you can find by clicking on the bot.\n\n" +
                    "Thank you for using Homina and have a wonderful day!\n\n" +
                    "*Note: This is an automated message that cannot be replied to.*",
            });

            logger.info(`Successfully sent deletion alert to user: ${userId}`);
        } catch (error) {
            logger.error(
                error,
                `Failed to send deletion alert to user: ${userId}`
            );
        }
    }
}
