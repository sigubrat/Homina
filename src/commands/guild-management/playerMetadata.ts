import { dbController, logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { fetchGuildMembers } from "@/client/MiddlewareClient";
import { testPlayerApiToken } from "@/lib/utils/commandUtils";
import {
    type ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 10;

export const data = new SlashCommandBuilder()
    .setName("player-metadata")
    .setDescription(
        "Show nicknames and player API token status for all guild members",
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const discordId = interaction.user.id;

    logger.info(
        `${interaction.user.username} attempting to use /player-metadata`,
    );

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

        const [members, metadata] = await Promise.all([
            fetchGuildMembers(guildId),
            dbController.getAllPlayerMetadataByGuild(guildId, false),
        ]);

        if (!members || members.length === 0) {
            await interaction.editReply({
                content:
                    "No members found. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        const metadataMap = new Map(metadata.map((m) => [m.userId, m]));

        // Test all stored player tokens in parallel
        const tokenValidityMap = new Map<string, boolean>();
        await Promise.all(
            metadata
                .filter((m) => m.playerToken)
                .map(async (m) => {
                    const valid = await testPlayerApiToken(m.playerToken!);
                    tokenValidityMap.set(m.userId, valid);
                }),
        );

        const lines = members
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .map((member) => {
                const meta = metadataMap.get(member.userId);
                const nickname = meta?.nickname ? ` — *${meta.nickname}*` : "";

                let tokenStatus: string;
                if (!meta?.playerToken) {
                    tokenStatus = "No token";
                } else if (tokenValidityMap.get(member.userId)) {
                    tokenStatus = "✅ Valid";
                } else {
                    tokenStatus = "❌ Invalid";
                }

                return `**${member.displayName}**${nickname} — ${tokenStatus}`;
            });

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle("Guild Player Metadata")
            .setDescription(
                "Shows each member's in-game name, their nickname override (if set), and whether a player-scope API token is stored and valid.\n" +
                    "Format: **InGameName** — *Nickname* — Token status\n\n" +
                    (lines.join("\n") || "No members found."),
            )
            .setFooter({
                text: "✅ Token valid  •  ❌ Token invalid/expired",
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        logger.info(
            `${interaction.user.username} successfully used /player-metadata`,
        );
    } catch (error) {
        logger.error(error, "Error fetching player metadata");
        await interaction.editReply({
            content: "An error occurred while fetching player metadata.",
        });
    }
}
