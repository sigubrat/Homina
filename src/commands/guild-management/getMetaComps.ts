import { logger } from "@/lib";
import { GuildService } from "@/lib/services/GuildService";
import { rankToElement } from "@/lib/utils/utils";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("meta-comps")
    .setDescription("See what meta comps players have in your guild")
    .addNumberOption((option) =>
        option
            .setName("minrank")
            .setDescription(
                "Minimum rank of the meta team to display (default: any rank)"
            )
            .addChoices(
                { name: "Iron", value: 3 },
                { name: "Bronze", value: 6 },
                { name: "Silver", value: 9 },
                { name: "Gold", value: 12 },
                { name: "Diamond", value: 15 },
                { name: "Adamantium", value: 18 }
            )
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const discordId = interaction.user.id;

    const service = new GuildService();
    const minRank = interaction.options.getNumber("minrank", false) || 0;

    try {
        const teams = await service.getGuildComps(discordId, minRank);

        if (!teams || Object.keys(teams).length === 0) {
            await interaction.editReply({
                content:
                    "No meta comps found for your guild.\n\n" +
                    "Please make sure you have registered any player-scope keys using the optional parameter in the /add-player command.\n" +
                    "See /help or the discord server if you have any questions.",
            });
            return;
        }

        let msg: string =
            `**Below are the meta comps each member of your guild has**\n` +
            `Guild members are only displayed if they have registered a player scope API key\n` +
            `Meta teams are currently defined as having at least Rho, Ragnar or Neuro for each team and having at least 5 characters that part of the meta team or a variation of it\n\n` +
            `:crossed_swords: *Multihit*\n:robot: *Admech*\n:brain: *Neuro*\n:shield: *Custodes*\n\n` +
            `**Minimum Rank**: ${rankToElement(minRank)}\n\n`;
        for (const [username, team] of Object.entries(teams)) {
            if (!team) {
                continue;
            }
            const { admech, multihit, neuro, custodes } = team;
            msg += `**${username}**: ${multihit ? ":crossed_swords:" : ":x:"}${
                admech ? ":robot:" : ":x:"
            }${neuro ? ":brain:" : ":x:"}${custodes ? ":shield:" : ":x:"}\n`;
        }

        await interaction.editReply({
            content: msg,
        });
    } catch (error) {
        logger.error(error, `Error executing /meta-comps command`);
        await interaction.editReply({
            content: "An error occurred while fetching meta comps.",
        });
    }
}
