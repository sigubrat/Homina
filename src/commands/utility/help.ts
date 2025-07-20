import { logger } from "@/lib";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";
import { Pagination } from "pagination.djs";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get an overview of the bot commands");

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({});

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
                    name: "First time setup for your guild",
                    value:
                        "1. Register your account using `/register`. You will need an API created by a (co-)leader in your guild with Guild and Raid scope checked off.\n" +
                        "2. Use `/member-ids` to get a list of members in the guild.\n" +
                        "3. Use the list and `/update-members` command to register usernames.\n",
                },
                {
                    name: "Register additional users",
                    value:
                        "1. If others in the guild want to use the bot they will have to register using the `/register` command.\n" +
                        "2. They will not need to update member IDs as that is shared by all guild members. Ready to go!\n" +
                        "Note: They must also register with an API key created by a (co-)leader in the guild with Guild and Raid scope checked off.\n",
                },
                {
                    name: "Updating members",
                    value:
                        "Members come and go, but that means you will need to update the member IDs stored in the bot. You have two options:\n" +
                        "1. Use `/member-ids`and add the username of the new member before using `/update-members`.\n" +
                        "2. Use `/add-member`or /remove-member` to add or remove a single member.\n",
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

        const githubBtn = new ButtonBuilder()
            .setLabel("GitHub")
            .setStyle(ButtonStyle.Link)
            .setEmoji("<:github:1396463516835385446>")
            .setURL("https://github.com/sigubrat/Homina");

        const docsBtn = new ButtonBuilder()
            .setLabel("Support server")
            .setStyle(ButtonStyle.Link)
            .setEmoji("<:homina:1393217807172239496>")
            .setURL("https://discord.gg/FajYxuWY9b");

        pagination.addActionRows([
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                githubBtn,
                docsBtn
            ),
        ]);

        await pagination.render();

        logger.info(`${interaction.user.username} used /help`);
    } catch (error) {
        logger.error(error, "Error executing /help command");
        await interaction.editReply({
            content:
                "An error occurred while trying to fetch help information.",
        });
    }
}
