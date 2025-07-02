import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("guild-token-status")
    .setDescription("See who has registered a player API token in your guild");

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;

    const service = new GuildService();

    try {
        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "Could not find your guild's ID. Please make sure you have registered your API-token.",
            });
            return;
        }

        const players = await service.getGuildMembersWithPlayerKey(guildId);
        if (!players || Object.values(players).length === 0) {
            await interaction.editReply({
                content:
                    "No players found with registered API tokens in your guild.",
            });
            return;
        }

        let playerStatus: string = "";

        for (const [username, status] of Object.entries(players).sort(
            (a, b) => {
                if (a[1] === b[1]) {
                    return 0;
                } else if (a[1] === true) {
                    return -1;
                }
                return 1;
            }
        )) {
            playerStatus += `${status ? "✅" : "❌"} - **${username}**\n`;
        }

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Guild Player API key Status")
            .setDescription(
                "Here is the list of players in your guild with registered API tokens:"
            )
            .setTimestamp()
            .setFields({
                name: "Player API key status",
                value: playerStatus,
            });

        await interaction.editReply({
            embeds: [embed],
        });
    } catch (error) {
        logger.error(error, `Error executing /guild-token-status command`);
        await interaction.editReply({
            content: "An error occurred while processing your request.",
        });
        return;
    }
}
