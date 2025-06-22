import { dbController, logger } from "@/lib";
import { SecondsToString } from "@/lib/utils";
import { EmbedBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const cooldown = 60;

export const data = new SlashCommandBuilder()
    .setName("bot-stats")
    .setDescription("Get statistics about the bot and its performance");

export async function execute(interaction: ChatInputCommandInteraction) {
    try {
        await interaction.deferReply({});

        const client = interaction.client;

        const uptime = client.uptime ? Math.floor(client.uptime / 1000) : 0;
        const formattedUptime = SecondsToString(uptime);
        const guildCount = client.guilds.cache.size;
        const registeredUser = await dbController.getNumberOfUsers();
        const registeredMembers = await dbController.getMemberCount();
        const registeredGuilds = await dbController.getGuildCount();

        const statsEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Bot Statistics")
            .setDescription("Here are the current statistics for the bot:")
            .addFields([
                { name: "Uptime", value: formattedUptime, inline: true },
                {
                    name: "Server count",
                    value: guildCount.toString(),
                    inline: false,
                },
                {
                    name: "User Count",
                    value: registeredUser.toString(),
                    inline: false,
                },
                {
                    name: "Guilds Count",
                    value: registeredGuilds.toString(),
                    inline: false,
                },
                {
                    name: "Guild-members Count",
                    value: registeredMembers.toString(),
                    inline: false,
                },
            ])
            .setTimestamp();

        await interaction.editReply({ embeds: [statsEmbed] });
    } catch (error) {
        logger.error(error);
        await interaction.editReply({
            content: "An error occurred while fetching the bot statistics.",
        });
    }
}
