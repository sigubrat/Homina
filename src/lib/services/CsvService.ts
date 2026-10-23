import type { MemberStatsPerSeason } from "@/commands/guild-raid/memberStatsBySeason";
import type { Highscore } from "@/models/types/Highscore";

type TeamKey =
    | "multihit"
    | "mech"
    | "neuro"
    | "custodes"
    | "battlesuit"
    | "lavstodes"
    | "other";

const CSV_TEAMS: { key: TeamKey; label: string }[] = [
    { key: "multihit", label: "Multihit" },
    { key: "mech", label: "Admech" },
    { key: "neuro", label: "Neuro" },
    { key: "custodes", label: "Custodes" },
    { key: "battlesuit", label: "Battlesuit" },
    { key: "lavstodes", label: "Lavstodes" },
    { key: "other", label: "Other" },
];

export class CsvService {
    async createMemberStats(data: MemberStatsPerSeason[]) {
        const header = [
            "Member",
            "Damage",
            "Tokens",
            "Avg",
            "Max",
            "Min",
            ...CSV_TEAMS.map((team) => `${team.label} use`),
            ...CSV_TEAMS.map((team) => `${team.label} dmg`),
        ];
        let output = header.join(",") + "\n";

        for (const member of data) {
            const avg = member.totalDamage / (member.totalTokens || 1);
            const d = member.distribution;
            const row = [
                `"${member.username || "Unknown"}"`,
                member.totalDamage,
                member.totalTokens,
                avg.toFixed(2),
                member.maxDmg,
                member.minDmg,
                ...CSV_TEAMS.map((team) => d[team.key] ?? 0),
                ...CSV_TEAMS.map((team) => d[`${team.key}Damage`] ?? 0),
            ];
            output += row.join(",") + "\n";
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
