const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

describe("Phase 2 foundation", () => {
  test("ships Expo's generated TypeScript references", () => {
    const declarationPath = path.resolve(__dirname, "../expo-env.d.ts");

    expect(existsSync(declarationPath)).toBe(true);
    expect(readFileSync(declarationPath, "utf8")).toContain(
      '/// <reference types="expo/types" />'
    );
    expect(readFileSync(declarationPath, "utf8")).toContain(
      '/// <reference types="expo-router/types" />'
    );

    const tsconfig = require("../tsconfig.json");
    expect(tsconfig.include).toEqual(
      expect.arrayContaining(["expo-env.d.ts", ".expo/types/**/*.ts"])
    );
  });

  test("exposes the storefront palette as React Native colors", () => {
    const { colors } = require("../src/theme");

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

  test("provides one shared radii and spacing scale", () => {
    const { radii, spacing } = require("../src/theme");

    expect(radii).toEqual({ small: 6, medium: 10, large: 16, xlarge: 24 });
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

  test("maps each language and the wordmark to its loaded font names", () => {
    const { fonts } = require("../src/theme");

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

  test("defines stable AsyncStorage and SecureStore keys", () => {
    const storage = require("../src/constants/storage");

    expect(storage).toEqual({
      AUTH_STORAGE_KEY: "capella.auth.v1",
      CART_STORAGE_KEY: "capella.cart.v1",
      CUSTOMER_REFRESH_TOKEN_KEY: "capella.customer.refresh-token.v1",
      LANG_STORAGE_KEY: "capella.lang.v1"
    });
  });
});
