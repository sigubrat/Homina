import { logger } from "@/lib";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5; // Cooldown in seconds

export const data = new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get an overview of the bot commands");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // @ts-expect-error - This works because our client is extended with commands (see index.ts in root)
    const commands = interaction.client.commands.map((command: any) => {
        return `* \`/${command.data.name}\` - ${command.data.description}`;
    });

    const embed = new EmbedBuilder()
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
                name: "Commands",
                value: commands.join("\n"),
            }
        )
        .setTimestamp()
        .setFooter({
            text: "Bot Help",
        });

    await interaction.editReply({
        embeds: [embed],
    });

    logger.info(`${interaction.user.username} used /help`);
}
