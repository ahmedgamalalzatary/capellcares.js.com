import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { resolveLocalizedEntityMediaUrl, type EntityImageMedia } from "@capella/shared";
import { useLang } from "@/lib/lang";
import { colors, spacing } from "@/theme";
import { UiText } from "@/components/ui/ui-text";
import { ErrorState } from "@/components/feedback/empty-state";
import { uiCopy } from "@/components/ui/copy";
export function MediaImage({ media, uri, label, style }: { media?: EntityImageMedia; uri?: string; label: string; style?: StyleProp<ViewStyle> }) {
  const { lang } = useLang(); const [failed, setFailed] = useState<string | null>(null); const [attempt, setAttempt] = useState(0);
  const url = media ? resolveLocalizedEntityMediaUrl(media, lang) : uri;
  return <View style={[{ aspectRatio: 1, width: "100%", backgroundColor: colors.surface, justifyContent: "center" }, style]}>
    {!url ? <UiText style={{ padding: spacing.medium }}>{uiCopy[lang].unavailableImage}</UiText>
      : failed === url ? <ErrorState message={uiCopy[lang].imageError} onRetry={() => { setAttempt(n => n + 1); setFailed(null); }} />
      : <Image key={`${url}:${attempt}`} source={{ uri: url }} accessibilityLabel={label} accessibilityRole="image" contentFit="contain"
        cachePolicy={attempt ? "none" : "memory-disk"} onError={() => setFailed(url)} style={{ width: "100%", height: "100%" }} />}
  </View>;
}
