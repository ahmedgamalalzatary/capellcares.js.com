import { radii, colors } from "../src/theme";

describe("mobile parchment theme", () => {
  it("uses the storefront hex palette", () => {
    expect(colors.canvas).toBe("#f1f0ed");
    expect(colors.ink).toBe("#0e0d0b");
    expect(colors.ink2).toBe("#3a3833");
    expect(colors.ink3).toBe("#6d6a62");
    expect(colors.accent).toBe("#46433c");
    expect(colors.accentDeep).toBe("#201e1a");
    expect(colors.warmSoft).toBe("#eae5d4");
    expect(colors.hairline).toBe("#c5bda6");
    expect(colors.error).toBe("#b13f2c");
    expect(colors.success).toBe("#2e7d4f");
    expect(colors.surface).toBe("#ffffff");
  });

  it("exposes the storefront radius scale", () => {
    expect(radii).toEqual({ small: 6, medium: 10, large: 16, xlarge: 24 });
  });
});
