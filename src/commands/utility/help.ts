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
    await interaction.deferReply({});

    try {
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
                "Useful information about the bot and its commands.\n\n",
            )
            .addFields(
                {
                    name: "Getting started",
                    value: "Register your account using `/register`. You will need an API key created by a (co-)leader in your guild with Guild and Raid scope checked off. Once registered, you're ready to use all bot commands!",
                },
                {
                    name: "Register additional users",
                    value: "Others in your guild can register using the `/register` command with their own API key (must be created by a co-leader with Guild and Raid scope).",
                },
                {
                    name: "__Commands:__",
                    value: "",
                },
            )
            .setTimestamp();

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

        const BMaCBtn = new ButtonBuilder()
            .setLabel("BuyMeACoffee")
            .setStyle(ButtonStyle.Link)
            .setEmoji("☕")
            .setURL("https://www.buymeacoffee.com/homina");

        pagination.addActionRows([
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                githubBtn,
                docsBtn,
                BMaCBtn,
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
