import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("player-token-status")
    .setDescription(
        "See who in your guild has a player token registered and who doesn't"
    );

export const cooldown = 5;

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;

    try {
        const service = new GuildService();

        const guildId = await service.getGuildId(discordId);
        if (!guildId) {
            await interaction.editReply({
                content:
                    "No guild found. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const members = await service.getGuildMembers(interaction.user.id);
        if (!members || members.length === 0) {
            await interaction.editReply({
                content:
                    "No members found. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const playerList = await service.getPlayerList(guildId);
        if (!playerList || playerList.length === 0) {
            await interaction.editReply({
                content:
                    "No members found in the memberlist. Ensure you have registered usernames for members",
            });
            return;
        }

        const usernames = members
            .map((member) => {
                const player = playerList.find((p) => p.userId === member);
                return [
                    player?.username ?? "No username",
                    player?.hasPlayerToken ? "✅" : "❌",
                ];
            })
            .sort((a, b) => a[1]!.localeCompare(b[1]!));

        const formattedUsernames = usernames.map(
            ([username, status]) => `${username} - ${status}`
        );

        const embed = new EmbedBuilder()
            .setTitle("Player Token Status")
            .setDescription("Here is the player token status for your guild:")
            .addFields([
                {
                    name: "Important information",
                    value: "Player tokens are not required, but enable additional features in the bot. Every player in your guild must create their own token with the player scope and give it to someone with a registered user or register it themselves if they have one.",
                },
                {
                    name: "How to register a player token",
                    value: "Use the `/add-member` command with the `player-api-token` option. This command updates the player, including usernames, for existing players and add them if they don't exist.",
                },
                {
                    name: "Members",
                    value: formattedUsernames.join("\n"),
                },
            ])
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.error(
            error,
            `Error executing /player-token-status by ${discordId}`
        );
        await interaction.editReply({
            content:
                "An error occurred while processing your request. Please try again later.",
        });
    }
}
