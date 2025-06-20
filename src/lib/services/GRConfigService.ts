import type { GrBossConfig } from "@/models/types";
import * as fs from "fs";

export class GRConfigService {
    private static instance: GRConfigService;
    private base = "guild_boss_season_config_";

    private config: Record<string, GrBossConfig> = {};

    private constructor() {
        // Load and parse the JSON config here
        const raw = fs.readFileSync(
            require.resolve("../configs/GuildBossSeasonConfigs.json"),
            "utf-8"
        );

        this.config = JSON.parse(raw);
    }

    public static getInstance(): GRConfigService {
        if (!GRConfigService.instance) {
            GRConfigService.instance = new GRConfigService();
        }
        return GRConfigService.instance;
    }

    public getConfigs() {
        return this.config;
    }

    public getConfig(n: number) {
        if (n < 1 || n > 5) {
            throw new Error("Invalid season number. Must be between 1 and 5.");
        }
        const key = `${this.base}${n}`;
        return this.config[key];
    }
}
