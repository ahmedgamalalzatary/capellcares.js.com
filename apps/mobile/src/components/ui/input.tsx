import { View } from "react-native";
import type { ComponentProps } from "react";
import { TextInput as PaperInput } from "react-native-paper";
import { colors, fonts, spacing } from "@/theme";
import { paperTheme } from "./paper-theme";
import { useLang } from "@/lib/lang";
import { UiText } from "@/components/ui/ui-text";
export function Input({ label, error, style, onFocus, onBlur, ...props }: Omit<ComponentProps<typeof PaperInput>, "label" | "error"> & { label: string; error?: string }) {
  const { lang } = useLang();
  return <View style={{ gap: spacing.small }}>
    <UiText weight="medium">{label}</UiText>
    <PaperInput {...props} mode="outlined" theme={paperTheme(lang)} error={Boolean(error)}
      accessibilityLabel={label} accessibilityHint={error || props.accessibilityHint}
      placeholderTextColor={colors.ink3} selectionColor={colors.accent}
      onFocus={onFocus} onBlur={onBlur}
      style={[{ minHeight: 52, fontFamily: fonts[lang].regular, fontSize: 16, color: colors.ink, backgroundColor: colors.surface,
        textAlign: lang === "ar" ? "right" : "left" }, style]} />
    {error && <UiText accessibilityRole="alert" style={{ color: colors.error }}>{error}</UiText>}
  </View>;
}
