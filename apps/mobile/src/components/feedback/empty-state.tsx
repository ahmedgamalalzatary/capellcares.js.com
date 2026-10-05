import { ActivityIndicator, View } from "react-native";
import { useLang } from "@/lib/lang";
import { colors, spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
import { Button } from "@/components/ui/button";
import { uiCopy } from "@/components/ui/copy";
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: { label: string; onPress: () => void } }) {
  return <View style={{ paddingVertical: spacing.xxlarge, gap: spacing.medium }}><UiText weight="bold" style={{ fontSize: 22 }}>{title}</UiText>
    {description && <UiText>{description}</UiText>}{action && <Button {...action} variant="outline" />}</View>;
}
export function LoadingState() {
  const { dict } = useLang();
  return <View accessible accessibilityLabel={dict.common.loading} accessibilityState={{ busy: true }}
    style={{ padding: spacing.xlarge, gap: spacing.small }}><ActivityIndicator color={colors.accent} /><UiText>{dict.common.loading}</UiText></View>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void | Promise<unknown> }) {
  const { lang } = useLang();
  return <View style={{ gap: spacing.medium }}><UiText accessibilityRole="alert" style={{ color: colors.error }}>{message}</UiText>
    {onRetry && <Button label={uiCopy[lang].retry} onPress={onRetry} variant="outline" />}</View>;
}
