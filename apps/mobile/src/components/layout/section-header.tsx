import { View } from "react-native";
import { spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return <View style={{ gap: spacing.small, marginTop: spacing.large }}><UiText weight="bold" accessibilityRole="header"
    style={{ fontSize: 26 }}>{title}</UiText>{description && <UiText>{description}</UiText>}</View>;
}
