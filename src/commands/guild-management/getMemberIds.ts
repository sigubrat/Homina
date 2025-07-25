import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService.ts";
import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("member-ids")
    .setDescription(
        "Get a list of members in the guild for use in registering usernames"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    logger.info(
        `${interaction.user.username} attempting to use /member-ids and received the member list`
    );

    const service = new GuildService();

    try {
        const members = await service.getGuildMembers(interaction.user.id);

        if (!members || members.length === 0) {
            await interaction.editReply({
                content:
                    "No members found. Ensure you are registered and have the correct permissions.",
            });
            return;
        }

        // Construct the JSON object
        const memberDataPromises = members.map(async (member) => {
            const username = await service.getUsernameById(member);
            return { [member]: username ?? "replace-with-username" };
        });
        const memberDataArray = await Promise.all(memberDataPromises);
        const memberData = memberDataArray.reduce(
            (acc, curr) => Object.assign(acc, curr),
            {}
        );

        const jsonBuffer = Buffer.from(
            JSON.stringify(memberData, null, 2),
            "utf-8"
        );

        const attachment = new AttachmentBuilder(jsonBuffer, {
            name: "memberlist.json",
        });

        const embed = new EmbedBuilder()
            .setColor("#0099ff")
            .setTitle("Member List")
            .setDescription(
                "Here is the list of members' IDs in the guild. You can use this to register usernames."
            )
            .addFields({
                name: "Next steps",
                value:
                    "1. Download the JSON file and open it in any text editor.\n" +
                    "2. Open up the game on your phone or pc and find the list of members in your guild.\n" +
                    "3. Replace the `replace-with-username` values with the actual usernames of the members in the order they're shown in the game. The order *must* be correct for the charts to be correct.\n" +
                    "4. Save the file and provide it as an attachment when you use the `/update-members` command.\n" +
                    "5. You're now ready to use the rest of the commands in the bot!",
            })
            .setTimestamp()
            .setFooter({
                text: "Guild Member ID list",
            });

        // Send the attachment
        await interaction.editReply({
            embeds: [embed],
            files: [attachment],
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });

        logger.info(
            `${interaction.user.username} used /member-ids and received the member list`
        );
    } catch (error) {
        logger.error(error, "Error fetching members:");
        await interaction.editReply({
            content: "An error occurred while fetching the member list.",
            options: {
                flags: MessageFlags.Ephemeral,
            },
        });
    }
}
