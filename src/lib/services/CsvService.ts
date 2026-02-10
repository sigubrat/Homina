import type { MemberStatsPerSeason } from "@/commands/guild-raid/memberStatsBySeason";
import type { Highscore } from "@/models/types/Highscore";

export class CsvService {
    async createMemberStats(data: MemberStatsPerSeason[]) {
        let output: string =
            "Member,Damage,Tokens, Avg,Max,Min,Multihit use, Mech use,Neuro use,Other use,MultiHit dmg,Mech dmg,Neuro dmg,Other dmg\n";

        for (const member of data) {
            const avg = member.totalDamage / (member.totalTokens || 1);
            output += `"${member.username || "Unknown"}",${
                member.totalDamage
            },${member.totalTokens},${avg.toFixed(2)},${member.maxDmg},${
                member.minDmg
            },${member.distribution.multihit},${member.distribution.mech},${
                member.distribution.neuro
            },${member.distribution.other},${
                member.distribution.multihitDamage
            },${member.distribution.mechDamage},${
                member.distribution.neuroDamage
            },${member.distribution.otherDamage}\n`;
        }

        // Convert string to buffer
        const buffer = Buffer.from(output, "utf-8");
        return buffer;
    }

    async createHighscores(highscores: Record<string, Highscore[]>) {
        let output = "";

        for (const [boss, scores] of Object.entries(highscores)) {
            output += `Boss: ${boss}\n`;
            output += "Rank,Username,Team,Damage\n";

            const sortedScores = scores.sort((a, b) => b.value - a.value);

            for (const [index, score] of sortedScores.entries()) {
                output += `${index + 1},${score.username},${score.team},${score.value}\n`;
            }

            output += "\n";
        }

        const buffer = Buffer.from(output, "utf-8");
        return buffer;
    }
}
