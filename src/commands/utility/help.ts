import { logger } from "@/lib";
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";
import { Pagination } from "pagination.djs";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get an overview of the bot commands");

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        // @ts-expect-error - This works because our client is extended with commands (see index.ts in root)
        const commands = interaction.client.commands.map((command: any) => {
            return [command.data.name, command.data.description];
        });

        const pagination = new Pagination(interaction, {
            limit: 10,
        })
            .setColor("#0099ff")
            .setTitle("Help")
            .setDescription(
                "Useful information about the bot and its commands.\n\n"
            )
            .addFields(
                {
                    name: "For new users",
                    value: "1. Register your account using `/register`.\n2. Use `/get-member-ids` to get a list of members in the guild.\n3. Use the list to register usernames.\n",
                },
                {
                    name: "__Commands:__",
                    value: "",
                }
            )
            .setTimestamp()
            .setFooter({
                text: "Bot Help",
            });

        for (const command of commands) {
            pagination.addFields({
                name: command[0],
                value: command[1],
            });
        }

        pagination.paginateFields(true);
        await pagination.render();

        logger.info(`${interaction.user.username} used /help`);
    } catch (error) {
        logger.error(error, "Error executing /help command");
        await interaction.editReply({
            content:
                "An error occurred while trying to fetch help information.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
    }
}
