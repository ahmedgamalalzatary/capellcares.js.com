import { radii, theme } from "../src/theme";

describe("mobile parchment theme", () => {
  it("uses the storefront hex palette", () => {
    expect(theme.canvas).toBe("#f1f0ed");
    expect(theme.ink).toBe("#0e0d0b");
    expect(theme.ink2).toBe("#3a3833");
    expect(theme.ink3).toBe("#6d6a62");
    expect(theme.accent).toBe("#46433c");
    expect(theme.accentDeep).toBe("#201e1a");
    expect(theme.warmSoft).toBe("#eae5d4");
    expect(theme.hairline).toBe("#c5bda6");
    expect(theme.error).toBe("#b13f2c");
    expect(theme.success).toBe("#2e7d4f");
    expect(theme.surface).toBe("#ffffff");
  });

  it("exposes the storefront radius scale", () => {
    expect(radii).toEqual({ sm: 6, md: 10, lg: 16, xl: 24 });
  });
});
