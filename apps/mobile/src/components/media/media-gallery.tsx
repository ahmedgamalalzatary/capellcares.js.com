import { useMemo, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { EntityMedia } from "@capella/shared";
import { galleryItems } from "@/lib/media";
import { useLang } from "@/lib/lang";
import { colors, spacing } from "@/theme";
import { MediaImage } from "@/components/media/media-image";
import { VideoPanel } from "@/components/media/video-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";
import { UiText } from "@/components/ui/ui-text";
import { uiCopy } from "@/components/ui/copy";
export function MediaGallery({ media, imagePath, videoUrl, label, active = true }: { media?: EntityMedia[];
  imagePath?: string | null; videoUrl?: string | null; label: string; active?: boolean }) {
  const { lang, dict } = useLang();
  const items = useMemo(() => galleryItems(media, lang, imagePath, videoUrl), [media, lang, imagePath, videoUrl]);
  const [selection, setSelection] = useState<{ url: string; index: number } | null>(null), [expanded, setExpanded] = useState(false);
  const selected = selection && items[selection.index]?.url === selection.url ? selection.index : 0;
  const item = items[selected];
  if (!item) return <EmptyState title={uiCopy[lang].emptyMedia} />;
  const select = (index: number) => setSelection({ url: items[index].url, index });
  const content = () => item.kind === "image" ? <MediaImage uri={item.url} label={label} />
    : <VideoPanel key={item.url} item={item} label={label} active={active} />;
  return <View style={{ gap: spacing.medium }}>
    {!expanded && content()}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.small, justifyContent: "space-between", alignItems: "center" }}>
      <Button label={dict.media.previous} iconOnly icon={<Feather name={lang === "ar" ? "chevron-right" : "chevron-left"} size={20} />}
        variant="outline" disabled={selected === 0} onPress={() => select(selected - 1)} />
      <UiText accessibilityLiveRegion="polite">{selected + 1} / {items.length}</UiText>
      <Button label={dict.media.next} iconOnly icon={<Feather name={lang === "ar" ? "chevron-left" : "chevron-right"} size={20} />}
        variant="outline" disabled={selected === items.length - 1} onPress={() => select(selected + 1)} />
      <Button label={uiCopy[lang].fullScreen} iconOnly icon={<Feather name="maximize" size={20} />} variant="outline" onPress={() => setExpanded(true)} />
    </View>
    <ScrollView horizontal contentContainerStyle={{ gap: spacing.small }}>
      {items.map((entry, index) => <Button key={`${entry.url}:${index}`} label={dict.media.thumbnail.replace("{index}", String(index + 1))}
        role="button" selected={index === selected} variant="outline" onPress={() => select(index)} />)}
    </ScrollView>
    <Modal visible={expanded} animationType="none" onRequestClose={() => setExpanded(false)}>
      <SafeAreaView style={{ flex: 1, padding: spacing.large, backgroundColor: colors.canvas }} accessibilityViewIsModal
        onAccessibilityEscape={() => setExpanded(false)}>
        <Button label={dict.media.close} variant="outline" onPress={() => setExpanded(false)} />
        <ScrollView contentContainerStyle={{ paddingTop: spacing.large }}>{expanded && content()}</ScrollView>
      </SafeAreaView>
    </Modal>
  </View>;
}
