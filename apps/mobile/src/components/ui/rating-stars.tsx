import { View } from "react-native";
import { Icon } from "react-native-paper";
import { useLang } from "@/lib/lang";
import { colors } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
export function RatingStars({ rating, count }: { rating: number; count: number }) {
  const { dict } = useLang(); if (count <= 0 || !Number.isFinite(rating)) return null;
  const safe = Math.min(5, Math.max(0, rating));
  const label = `${dict.reviews.outOfFive.replace("{rating}", String(safe))}, ${dict.reviews.reviewCount.replace("{count}", String(count))}`;
  return <View accessible accessibilityLabel={label} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
    <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row" }}>
      {[0, 1, 2, 3, 4].map(index => <Icon key={index} source={safe >= index + 1 ? "star" : safe > index ? "star-half-full" : "star-outline"}
        size={16} color={colors.accent} />)}
    </View>
    <UiText style={{ fontSize: 14 }}>{safe} ({count})</UiText>
  </View>;
}
