import { GuildService } from "@/lib/services/GuildService";
import { isValidUUIDv4 } from "@/lib/utils/mathUtilts";
import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("add-member")
    .setDescription("Add a member to the guild by providing their user ID")
    .addStringOption((option) =>
        option
            .setName("user-id")
            .setDescription("The user ID of the member to add")
            .setRequired(true)
            .setMinLength(36)
            .setMaxLength(36)
    )
    .addStringOption((option) =>
        option
            .setName("username")
            .setDescription("The username of the member to add")
            .setRequired(true)
    )
    .addStringOption((option) => {
        option
            .setName("player-api-token")
            .setDescription("The API token of the player to add (optional)")
            .setRequired(false)
            .setMinLength(36)
            .setMaxLength(36);
        return option;
    });

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.options.getString("user-id");
    if (!userId || !isValidUUIDv4(userId)) {
        await interaction.editReply({
            content: "Please provide a valid user ID.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    if (!isValidUUIDv4(userId)) {
        await interaction.editReply({
            content:
                "Invalid user ID format. Please provide a valid UUID (v4).",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    const username = interaction.options.getString("username");
    if (!username) {
        await interaction.editReply({
            content: "Please provide a valid username.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    const service = new GuildService();

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

    const apiToken = interaction.options.getString("player-api-token");

    if (apiToken && !isValidUUIDv4(apiToken)) {
        await interaction.editReply({
            content:
                "Invalid API token format. Please provide a valid UUID (v4) for the player API token.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
        return;
    }

    const result = await service.updateGuildMember(
        userId,
        username,
        guildId,
        apiToken ?? undefined
    );
    if (result) {
        await interaction.editReply({
            content: `Successfully added member with ID \`${userId}\` and username \`${username}\` to the guild.`,
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
    } else {
        await interaction.editReply({
            content: "Failed to add the member to the guild.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
    }
}
