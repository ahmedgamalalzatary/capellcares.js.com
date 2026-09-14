export const colors = {
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
} as const;

export const radii = {
  small: 6,
  medium: 10,
  large: 16,
  xlarge: 24
} as const;

export const spacing = {
  xsmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  xlarge: 24,
  xxlarge: 32,
  xxxlarge: 48
} as const;

export const fonts = {
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
} as const;
