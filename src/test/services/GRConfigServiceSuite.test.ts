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
        expect(config1).toHaveProperty("Common");
        expect(config1).toHaveProperty("Uncommon");
        expect(config1).toHaveProperty("Rare");
        expect(config1).toHaveProperty("Epic");
        expect(config1).toHaveProperty("Legendary");
    });

    test("should contain the correct values for the rarity levels", () => {
        const config = configService.getConfig(1);
        expect(config).toBeDefined();
        expect(config).toHaveProperty("Common");
        expect(config).toHaveProperty("Uncommon");
        expect(config).toHaveProperty("Rare");
        expect(config).toHaveProperty("Epic");
        expect(config).toHaveProperty("Legendary");
        expect(config!.Common.length).toEqual(4);
        expect(config!.Uncommon.length).toEqual(4);
        expect(config!.Rare.length).toEqual(4);
        expect(config!.Epic.length).toEqual(5);
        expect(config!.Legendary.length).toEqual(5);
        expect(config!.Common[0]).toBe("C0 Tervigon (Leviathan)");
        expect(config!.Uncommon[0]).toBe("U0 Hive Tyrant (Kronos)");
        expect(config!.Legendary[3]).toBe("L3 Szarekh");
    });
});
