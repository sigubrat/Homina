import { getAllCommands } from "@/lib/utils/commandUtils";
import { describe, expect, test } from "bun:test";

describe("commandUtils - Algebra", () => {
    test("getCommands - Should fetch a promise that resolves to a collection of commands", async () => {
        const commands = await getAllCommands();
        expect(commands).toBeDefined();
        expect(commands.size).toBeGreaterThan(0);
        expect(commands.first()).toHaveProperty("data");
        expect(commands.first()).toHaveProperty("execute");
    });
});
