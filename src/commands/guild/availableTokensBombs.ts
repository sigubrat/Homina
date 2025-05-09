import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("available-tokens-bombs")
    .setDescription(
        "Get an overview of how many guild raid tokens and bombs each member has available"
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({
        content:
            "This command is currently disabled due to lacking access to the player API. A solution for this is underway.",
    });
    return;
    // await interaction.deferReply();

    // const service = new GuildService();

    // logger.info(
    //     `${interaction.user.username} attempting to use /available-tokens-bombs`
    // );

    // try {
    //     const result = await service.getAvailableTokensAndBombs(
    //         interaction.user.id
    //     );

    //     if (
    //         !result ||
    //         typeof result !== "object" ||
    //         Object.keys(result).length === 0
    //     ) {
    //         await interaction.editReply({
    //             content:
    //                 "No data found for the current season. Ensure you are registered and have the correct permissions.",
    //         });
    //         return;
    //     }

    //     const filtered = Object.entries(result).filter(([, available]) => {
    //         return available.tokens > 0 || available.bombs > 0;
    //     });

    //     const table = filtered
    //         .map(
    //             ([userId, available]) =>
    //                 `\`${userId}\`: ${available.tokens} tokens, ${available.bombs} bombs `
    //         )
    //         .join("\n");

    //     if (table.length === 0) {
    //         await interaction.editReply({
    //             content: "No members have available tokens or bombs right now.",
    //         });
    //         return;
    //     }

    //     const embed = new EmbedBuilder()
    //         .setColor("#0099ff")
    //         .setTitle("Available Tokens and Bombs")
    //         .setDescription(
    //             "Here is the list of members with available tokens and bombs:\n"
    //         )
    //         .setFields([
    //             {
    //                 name: "Available Tokens and Bombs",
    //                 value: table,
    //             },
    //         ])
    //         .setTimestamp()
    //         .setFooter({
    //             text: "Data fetched from the guild raid API",
    //         });

    //     await interaction.editReply({ embeds: [embed] });
    // } catch (error) {
    //     logger.error(
    //         error,
    //         `Error occured in available-tokens-bombs by ${interaction.user.username}`
    //     );
    //     await interaction.editReply({
    //         content:
    //             "An error occurred while fetching the data. Please try again later or contact the Bot developer if the problem persists.",
    //     });
    //     return;
    // }
}
