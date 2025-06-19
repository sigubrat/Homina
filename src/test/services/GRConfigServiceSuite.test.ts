import { GRConfigService } from "@/lib/services/GRConfigService";
import { describe, expect, test } from "bun:test";

const configService = GRConfigService.getInstance();

describe("GRConfigServiceSuite", () => {
    test("should return the same instance (singleton)", () => {
        const instance1 = GRConfigService.getInstance();
        const instance2 = GRConfigService.getInstance();
        expect(instance1).toBe(instance2);
    });

    test("should load config with expected keys", () => {
        const config = configService.getConfigs();
        expect(config).toBeDefined();
        expect(typeof config).toBe("object");
        expect(config).toHaveProperty("guild_boss_season_config_1");
    });

    test("should have all required properties in a config", () => {
        const config = configService.getConfigs();
        const config1 = config["guild_boss_season_config_1"];
        expect(config1).toHaveProperty("common");
        expect(config1).toHaveProperty("uncommon");
        expect(config1).toHaveProperty("rare");
        expect(config1).toHaveProperty("epic");
        expect(config1).toHaveProperty("legendary");
    });

    test("should contain the correct values for the rarity levels", () => {
        const config = configService.getConfig(1);
        expect(config).toBeDefined();
        expect(config).toHaveProperty("common");
        expect(config).toHaveProperty("uncommon");
        expect(config).toHaveProperty("rare");
        expect(config).toHaveProperty("epic");
        expect(config).toHaveProperty("legendary");
        expect(config!.common.length).toEqual(4);
        expect(config!.uncommon.length).toEqual(4);
        expect(config!.rare.length).toEqual(4);
        expect(config!.epic.length).toEqual(5);
        expect(config!.legendary.length).toEqual(5);
        expect(config!.common[0]).toBe("C0 Tervigon (Leviathan)");
        expect(config!.uncommon[0]).toBe("U0 Hive Tyrant (Kronos)");
        expect(config!.legendary[3]).toBe("L3 Silent King");
    });
});
