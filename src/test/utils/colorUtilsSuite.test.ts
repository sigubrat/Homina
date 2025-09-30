import { namedColor, CHART_COLORS } from "@/lib/utils/colorUtils";
import { describe, expect, test } from "bun:test";

describe("colorUtilsSuite", () => {
    // Placeholder for future tests related to colorUtils
    test("namedColor - Should return the correct color", () => {
        const index = 1;
        const color = namedColor(index);
        expect(color).toBe("rgb(255, 159, 64)");
    });

    test("CHART_COLORS - Should return the correct color", () => {
        const color = CHART_COLORS.red;
        expect(color).toBe("rgb(255, 99, 132)");
    });
});
