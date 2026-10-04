import { colors, fonts, radii, spacing } from "../src/theme";

describe("mobile parchment theme", () => {
  it("matches the sRGB conversions of the storefront OKLCH palette", () => {
    expect(colors).toEqual({
      canvas: "#f1f0ed",
      ink: "#070603",
      ink2: "#2c2922",
      ink3: "#605d57",
      accent: "#373228",
      accentDeep: "#14110c",
      warmSoft: "#eae4d4",
      hairline: "#beb7a4",
      error: "#ad301b",
      success: "#417843",
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
