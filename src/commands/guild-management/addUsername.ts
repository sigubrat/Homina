import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("add-username")
    .setDescription(
        "Add username to the first member in the memberlist without a username"
    )
    .addStringOption((option) =>
        option
            .setName("username")
            .setDescription("The username of the member")
            .setRequired(true)
            .setMinLength(1)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const username = interaction.options.getString("username", true);
        if (!username || username.length < 0) {
            await interaction.editReply({
                content: "Please provide a valid username.",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
            return;
        }

        const service = new GuildService();

        // First get all active members of the guild
        const members = await service.getGuildMembers(interaction.user.id);
        if (!members || members.length === 0) {
            await interaction.editReply({
                content: "No members found in the guild.",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
            return;
        }

        const memberDataPromises = members.map(async (member) => {
            const username = await service.getUsernameById(member);
            return { [member]: username ?? "replace-with-username" };
        });
        const memberDataArray = await Promise.all(memberDataPromises);

        // Find the first member with username 'replace-with-username'
        const recentMember = memberDataArray.find(
            (member) => Object.values(member)[0] === "replace-with-username"
        );

        if (!recentMember) {
            await interaction.editReply({
                content: "No recent member found without a username",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
            return;
        }

        const recentMemberId = Object.keys(recentMember)[0];
        if (!recentMemberId) {
            await interaction.editReply({
                content: "No recent member found without a user ID",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
            return;
        }

        const guildId = await service.getGuildId(interaction.user.id);
        if (!guildId) {
            await interaction.editReply({
                content: "Did not find a guild for your user ID.",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
            return;
        }

        const result = await service.updateGuildMember(
            recentMemberId,
            username,
            guildId
        );

        if (result) {
            await interaction.editReply({
                content: `Successfully added recent member with ID \`${recentMemberId}\` and username \`${username}\` to the guild.`,
            });
        } else {
            await interaction.editReply({
                content: "Failed to add the recent member to the guild.",
                options: {
                    flags: MessageFlags.Ephemeral,
                },
            });
        }
    } catch (error) {
        logger.error(error, "Error while adding recent member");
        await interaction.editReply({
            content: "An error occurred while adding the recent member.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
    }
}
