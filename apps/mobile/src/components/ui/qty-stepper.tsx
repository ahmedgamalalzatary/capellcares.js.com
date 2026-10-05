import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLang } from "@/lib/lang";
import { spacing } from "@/theme";
import { Button } from "@/components/ui/button";
import { UiText } from "@/components/ui/ui-text";
import { uiCopy } from "@/components/ui/copy";
export function QtyStepper({ value, max, min = 1, disabled = false, onChange }: {
  value: number; max: number; min?: number; disabled?: boolean; onChange: (value: number) => void;
}) {
  const { lang, dict } = useLang(); const copy = uiCopy[lang];
  return <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.small }}>
    <Button label={copy.decrease} iconOnly icon={<Feather name="minus" size={18} />} variant="outline" disabled={disabled || value <= min} onPress={() => {
      if (value > min) onChange(Math.max(min, value - 1));
    }} />
    <UiText accessibilityLabel={dict.common.quantity} accessibilityValue={{ min, max, now: value }}
      accessibilityLiveRegion="polite" weight="medium" style={{ minWidth: 28, textAlign: "center" }}>{value}</UiText>
    <Button label={copy.increase} iconOnly icon={<Feather name="plus" size={18} />} variant="outline" disabled={disabled || value >= max} onPress={() => {
      if (value < max) onChange(Math.min(max, value + 1));
    }} />
  </View>;
}
