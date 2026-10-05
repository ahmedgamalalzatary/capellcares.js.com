import { ScrollView } from "react-native";
import { Dialog, Portal } from "react-native-paper";
import { useLang } from "@/lib/lang";
import { colors, radii, spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
import { Button } from "@/components/ui/button";
import { paperTheme } from "@/components/ui/paper-theme";
export function ConfirmDialog({ visible, title, message, confirmLabel, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string; confirmLabel: string;
  onConfirm: () => void | Promise<unknown>; onCancel: () => void;
}) {
  const { dict, lang } = useLang();
  return <Portal><Dialog visible={visible} onDismiss={onCancel} dismissableBackButton theme={paperTheme(lang)}
    style={{ backgroundColor: colors.surface, borderRadius: radii.large, maxHeight: "90%", width: "90%", maxWidth: 560, alignSelf: "center" }}>
      <Dialog.Title accessibilityRole="header">{title}</Dialog.Title>
      <Dialog.Content><ScrollView><UiText style={{ marginTop: spacing.medium }}>{message}</UiText></ScrollView></Dialog.Content>
      <Dialog.Actions>
        <Button label={dict.common.cancel} onPress={onCancel} variant="ghost" />
        <Button label={confirmLabel} onPress={onConfirm} />
      </Dialog.Actions>
  </Dialog></Portal>;
}
