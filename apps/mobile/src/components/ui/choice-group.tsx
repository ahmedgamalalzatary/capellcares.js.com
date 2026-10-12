import { Platform, View } from "react-native";
import { spacing, colors } from "@/theme";
import { RadioButton, TouchableRipple } from "react-native-paper";
import { useLang } from "@/lib/lang";
import { paperTheme } from "./paper-theme";
import { UiText } from "@/components/ui/ui-text";
export function ChoiceGroup({ label, value, options, onChange }: { label: string; value: string;
  options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const { lang } = useLang();
  return <View style={{ gap: spacing.small }}><UiText weight="medium">{label}</UiText>
    <RadioButton.Group value={value} onValueChange={onChange}>
      {options.map(option => Platform.OS === "web" ? <TouchableRipple key={option.value} accessibilityRole="radio"
        accessibilityLabel={option.label} aria-checked={value === option.value} onPress={() => onChange(option.value)}
        style={{ minHeight: 48, padding: spacing.small }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.small }}>
            <View aria-hidden pointerEvents="none"><RadioButton value={option.value} status={value === option.value ? "checked" : "unchecked"} color={colors.accent} /></View>
            <UiText>{option.label}</UiText>
          </View>
        </TouchableRipple> : <RadioButton.Item key={option.value} label={option.label} value={option.value}
        theme={paperTheme(lang)} style={{ minHeight: 48 }} position={lang === "ar" ? "trailing" : "leading"} />)}
    </RadioButton.Group>
  </View>;
}
