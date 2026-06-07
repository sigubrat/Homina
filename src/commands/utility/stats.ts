import { dbController } from "@/lib";
import { handleCommandError } from "@/lib/utils/errorUtils";
import { SecondsToString } from "@/lib/utils/timeUtils";
import { EmbedBuilder } from "@discordjs/builders";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getPackageVersion } from "@/lib/utils/utils";

export const cooldown = 60;
const commandName = "bot-stats";

export const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription("Get statistics about the bot and its performance");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});

    try {
        const client = interaction.client;

        const uptime = client.uptime ? Math.floor(client.uptime / 1000) : 0;
        const formattedUptime = SecondsToString(uptime);
        const guildCount = client.guilds.cache.size;
        const registeredUser = await dbController.getNumberOfUsers();
        const registeredGuilds = await dbController.getGuildCount();
        const registeredMembers = registeredGuilds * 30; // Assuming an average of 30 members per guild
        const ver = await getPackageVersion();

        const statsEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Bot Statistics")
            .setDescription("Here are the current statistics for the bot:")
            .addFields([
                {
                    name: "Version",
                    value: ver ?? "N/A",
                    inline: false,
                },
                { name: "Uptime", value: formattedUptime, inline: false },
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
                    name: "Members Count",
                    value: `Running stats for approximately ${registeredMembers.toString()} players`,
                    inline: false,
                },
            ])
            .setTimestamp();

        await interaction.editReply({ embeds: [statsEmbed] });
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
