import { View } from "react-native";
import { colors, radii, spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
export function Badge({ label }: { label: string }) {
  return <View style={{ backgroundColor: colors.warmSoft, paddingHorizontal: spacing.small, paddingVertical: spacing.xsmall,
    borderRadius: radii.small, alignSelf: "flex-start" }}><UiText weight="medium" style={{ fontSize: 14 }}>{label}</UiText></View>;
}
