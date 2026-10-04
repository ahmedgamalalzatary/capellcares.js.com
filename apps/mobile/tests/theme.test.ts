import { colors, fonts, radii, spacing } from "../src/theme";

describe("mobile parchment theme", () => {
  it("uses the storefront hex palette", () => {
    expect(colors).toEqual({
      canvas: "#f1f0ed",
      ink: "#0e0d0b",
      ink2: "#3a3833",
      ink3: "#6d6a62",
      accent: "#46433c",
      accentDeep: "#201e1a",
      warmSoft: "#eae5d4",
      hairline: "#c5bda6",
      error: "#b13f2c",
      success: "#2e7d4f",
      surface: "#ffffff"
    });
  });

  it("exposes the storefront radius scale", () => {
    expect(radii).toEqual({ small: 6, medium: 10, large: 16, xlarge: 24 });
  });

  it("provides one shared spacing scale", () => {
    expect(spacing).toEqual({
      xsmall: 4,
      small: 8,
      medium: 12,
      large: 16,
      xlarge: 24,
      xxlarge: 32,
      xxxlarge: 48
    });
  });

  it("maps each language and the wordmark to its loaded font names", () => {
    expect(fonts).toEqual({
      ar: {
        regular: "Tajawal_400Regular",
        medium: "Tajawal_500Medium",
        bold: "Tajawal_700Bold"
      },
      en: {
        regular: "Roboto_400Regular",
        medium: "Roboto_500Medium",
        bold: "Roboto_700Bold"
      },
      wordmark: "Lobster_400Regular"
    });
  });
});
