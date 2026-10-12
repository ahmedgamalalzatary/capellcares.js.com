import { configureFonts, MD3LightTheme, type MD3Theme } from "react-native-paper";
import { colors, fonts, radii } from "@/theme";
import type { Language } from "@capella/shared";
export function paperTheme(lang: Language): MD3Theme {
  return { ...MD3LightTheme, roundness: radii.medium / 4, fonts: configureFonts({ config: { fontFamily: fonts[lang].regular } }),
    animation: { scale: 0 }, colors: { ...MD3LightTheme.colors, primary: colors.accent, onPrimary: colors.surface,
      secondary: colors.accent, secondaryContainer: colors.warmSoft, onSecondaryContainer: colors.ink,
      background: colors.canvas, onBackground: colors.ink, surface: colors.surface, onSurface: colors.ink,
      surfaceVariant: colors.warmSoft, onSurfaceVariant: colors.ink3, outline: colors.hairline,
      error: colors.error, onSurfaceDisabled: colors.ink3, surfaceDisabled: colors.warmSoft,
      elevation: { level0: "transparent", level1: colors.surface, level2: colors.surface, level3: colors.surface, level4: colors.surface, level5: colors.surface } }
  };
}
