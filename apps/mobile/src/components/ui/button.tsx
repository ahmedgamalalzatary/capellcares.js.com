import { cloneElement, isValidElement, useRef, useState, type ReactNode } from "react";
import { View, type AccessibilityRole, type StyleProp, type ViewStyle } from "react-native";
import { Button as PaperButton, IconButton } from "react-native-paper";
import { useLang } from "@/lib/lang";
import { colors, radii, fonts } from "@/theme";
import { paperTheme } from "./paper-theme";
import { UiText } from "@/components/ui/ui-text";
import { uiCopy } from "@/components/ui/copy";
export type ButtonProps = { label: string; onPress: () => void | Promise<unknown>; disabled?: boolean; loading?: boolean;
  variant?: "primary" | "outline" | "ghost"; selected?: boolean; role?: AccessibilityRole; style?: StyleProp<ViewStyle>;
  icon?: ReactNode; iconOnly?: boolean };
export function Button({ label, onPress, disabled = false, loading = false, variant = "primary", selected, role = "button", style, icon, iconOnly }: ButtonProps) {
  const { lang, dict } = useLang();
  const active = useRef(false);
  const [running, setRunning] = useState(false), [failed, setFailed] = useState(false), [focused, setFocused] = useState(false);
  const busy = loading || running;
  const blocked = disabled || busy;
  const invoke = async () => {
    if (blocked || active.current) return;
    active.current = true; setFailed(false);
    try {
      const result = onPress();
      if (result && typeof result.then === "function") { setRunning(true); await result; }
    } catch { setFailed(true); } finally { active.current = false; setRunning(false); }
  };
  const foreground = disabled ? colors.ink3 : variant === "primary" ? colors.surface : colors.accent;
  const tintedIcon = isValidElement<{ color?: string }>(icon) ? cloneElement(icon, { color: foreground }) : icon;
  const shared = { theme: paperTheme(lang), disabled: blocked, loading: busy, accessibilityLabel: label,
    accessibilityHint: busy ? dict.common.loading : undefined, onPress: () => void invoke(),
    onFocus: () => setFocused(true), onBlur: () => setFocused(false) };
  const frame = [{ borderRadius: radii.medium, borderWidth: 2,
    borderColor: focused || variant === "outline" ? colors.accent : "transparent", minWidth: 48 }, style];
  return <View>{iconOnly ? <IconButton {...shared} icon={() => tintedIcon} size={20} iconColor={foreground}
    containerColor={disabled ? colors.warmSoft : undefined}
    accessibilityState={{ disabled: blocked, busy, selected }} style={[{ margin: 0, width: 48, height: 48 }, frame]} />
    : <PaperButton {...shared} accessibilityRole={role} mode={variant === "primary" ? "contained" : variant === "outline" ? "outlined" : "text"}
      icon={icon ? () => tintedIcon : undefined} textColor={foreground}
      buttonColor={disabled || selected ? colors.warmSoft : variant === "primary" ? colors.accent : undefined}
      rippleColor={variant === "primary" ? colors.accentDeep : colors.warmSoft}
      style={frame} contentStyle={{ minHeight: 48 }} labelStyle={{ fontFamily: fonts[lang].medium, fontSize: 16 }}>{label}</PaperButton>}
    {failed && <UiText accessibilityRole="alert" style={{ color: colors.error }}>{uiCopy[lang].actionFailed}</UiText>}</View>;
}
