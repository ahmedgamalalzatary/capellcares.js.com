import { useState } from "react";
import { Linking, Platform, View } from "react-native";
import type { AppUpdateRequired } from "@capella/shared";
import { useLang } from "@/lib/lang";
import { usePolicy } from "@/lib/policy";
import { colors, radii, spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
import { Button } from "@/components/ui/button";
import { uiCopy } from "@/components/ui/copy";

export function validStoreDestination(value: string): boolean {
  try {
    const url = new URL(value);
    const host = Platform.OS === "ios" ? "apps.apple.com" : Platform.OS === "android" ? "play.google.com" : null;
    return url.protocol === "https:" && !url.username && !url.password &&
      (host ? url.hostname === host : ["apps.apple.com", "play.google.com"].includes(url.hostname));
  } catch { return false; }
}
export function UpdateNotice({ title, explanation, storeUrl, onDismiss }: {
  title: string; explanation: { ar: string; en: string }; storeUrl: string; onDismiss?: () => Promise<void>;
}) {
  const { lang } = useLang(); const [failed, setFailed] = useState(false);
  const open = async () => {
    setFailed(false);
    try {
      if (!validStoreDestination(storeUrl)) throw new Error("Invalid store destination");
      await Linking.openURL(storeUrl);
    } catch { setFailed(true); }
  };
  return <View style={{ padding: spacing.large, gap: spacing.medium, borderRadius: radii.large,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline }}>
    <UiText accessibilityRole="header" weight="bold" style={{ fontSize: 20 }}>{title}</UiText>
    <UiText>{explanation[lang]}</UiText>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.small }}>
      <Button label={uiCopy[lang].openStore} onPress={open} />
      {onDismiss && <Button label={uiCopy[lang].later} onPress={onDismiss} variant="ghost" />}
    </View>
    {failed && <UiText accessibilityRole="alert" style={{ color: colors.error }}>{uiCopy[lang].storeError}</UiText>}
  </View>;
}
export function RecommendedUpdate() {
  const { recommendedUpdate, dismissRecommendedUpdate } = usePolicy(); const { lang } = useLang();
  return recommendedUpdate ? <UpdateNotice title={uiCopy[lang].updateAvailable} {...recommendedUpdate}
    onDismiss={dismissRecommendedUpdate} /> : null;
}
export function FeatureUpdateRequired({ requirement }: { requirement: AppUpdateRequired }) {
  const { lang } = useLang();
  return <UpdateNotice title={uiCopy[lang].updateRequired} explanation={requirement.explanation} storeUrl={requirement.storeUrl} />;
}
