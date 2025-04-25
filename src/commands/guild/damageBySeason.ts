import { GuildService } from "@/lib/services/GuildService";
import { ChartService } from "@/lib/services/ChartService";
import {
    AttachmentBuilder,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";

export const cooldown = 5;

export const data = new SlashCommandBuilder()
    .setName("damagebyseason")
    .addNumberOption((option) => {
        return option
            .setName("season")
            .setDescription("The season number")
            .setRequired(true);
    })
    .setDescription(
        "Check how much damage each member has done in a given season"
    );

export async function execute(interaction: any) {
    await interaction.deferReply();

    const service = new GuildService();

    const season = interaction.options.getNumber("season") as number;

    const result = await service.getDamageBySeason(interaction.user.id, season);

    if (!result || typeof result !== "object") {
        await interaction.editReply({
            content:
                "Could not fetch damage done by season. Ensure you are registered and have the correct permissions",
        });
        return;
    } else if (Object.keys(result).length === 0) {
        await interaction.editReply({
            content: "No damage done in this season",
        });

        return;
    }

    const chartService = new ChartService(1200, 800);

    const chartBuffer = await chartService.createSeasonDamageChart(
        result.sort((a, b) => b.totalDamage - a.totalDamage),
        "Damage dealt in season " + season
    );

    const attachment = new AttachmentBuilder(chartBuffer, {
        name: "graph.png",
    });

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle("Damage dealt in season " + season)
        .setDescription(
            "Damage dealt by each member in season " + season + "\n"
        )
        .setImage("attachment://graph.png");

    await interaction.editReply({ embeds: [embed], files: [attachment] });
}
