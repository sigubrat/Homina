import type { MemberStatsPerSeason } from "@/commands/guild/memberStatsBySeason";

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
                member.distribution.psyker
            },${member.distribution.other},${
                member.distribution.multihitDamage
            }, ${member.distribution.mechDamage},${
                member.distribution.psykerDamage
            },${member.distribution.otherDamage}\n`;
        }

        // Convert string to buffer
        const buffer = Buffer.from(output, "utf-8");
        return buffer;
    }
}
