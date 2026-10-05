import { View } from "react-native";
import { formatPrice } from "@capella/shared";
import { useLang } from "@/lib/lang";
import { colors, spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
export function PriceText({ amount, original }: { amount: number; original?: number }) {
  const { lang } = useLang();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.small, alignItems: "baseline" }}>
    <UiText weight="bold">{formatPrice(amount, lang)}</UiText>
    {original != null && original > amount && <UiText accessibilityLabel={formatPrice(original, lang)}
      style={{ color: colors.ink3, textDecorationLine: "line-through" }}>{formatPrice(original, lang)}</UiText>}
  </View>;
}
