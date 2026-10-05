import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { useVideoPlayer, VideoView, type VideoPlayerStatus } from "expo-video";
import { useLang } from "@/lib/lang";
import type { GalleryItem } from "@/lib/media";
import { spacing } from "@/theme";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/empty-state";
import { LinkedVideo } from "@/components/media/linked-video";
import { uiCopy } from "@/components/ui/copy";

function usePlaybackActive(active: boolean) {
  const [foreground, setForeground] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  return active && foreground;
}
function FileVideo({ url, label, active }: { url: string; label: string; active: boolean }) {
  const player = useVideoPlayer(url);
  const { lang } = useLang();
  const [status, setStatus] = useState<VideoPlayerStatus>(player.status);
  const [failed, setFailed] = useState(false);
  const playbackActive = active;
  useEffect(() => { if (!playbackActive) player.pause(); }, [playbackActive, player]);
  useEffect(() => {
    const subscription = player.addListener("statusChange", event => setStatus(event.status));
    // useVideoPlayer releases/stops the native player on unmount; do not call
    // methods on that released shared object during another cleanup.
    return () => subscription.remove();
  }, [player]);
  const retry = async () => {
    setFailed(false);
    try { await player.replaceAsync(url); } catch { setFailed(true); }
  };
  if (status === "error" || failed) return <ErrorState message={uiCopy[lang].videoError} onRetry={retry} />;
  return <View style={{ gap: spacing.small }}>
    {playbackActive && <VideoView player={player} accessibilityLabel={label} nativeControls contentFit="contain"
      fullscreenOptions={{ enable: true }} style={{ width: "100%", aspectRatio: 16 / 9 }} />}
    <Button label={uiCopy[lang].play} disabled={!playbackActive || status === "loading"} variant="outline" onPress={() => player.play()} />
  </View>;
}
function EmbeddedVideo({ item, label }: { item: Extract<GalleryItem, { kind: "embed" }>; label: string }) {
  const { lang } = useLang(); const [playing, setPlaying] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  if (failed) return <ErrorState message={uiCopy[lang].videoError} onRetry={() => { setFailed(false); setAttempt(n => n + 1); }} />;
  return playing ? <LinkedVideo key={attempt} url={item.url} label={label} onError={() => setFailed(true)} />
    : <Button label={uiCopy[lang].play} variant="outline" onPress={() => setPlaying(true)} />;
}
export function VideoPanel({ item, label, active = true }: { item: GalleryItem; label: string; active?: boolean }) {
  const playbackActive = usePlaybackActive(active); const { lang } = useLang();
  return item.kind === "embed" ? playbackActive ? <EmbeddedVideo item={item} label={label} />
    : <Button label={uiCopy[lang].play} disabled variant="outline" onPress={() => {}} />
    : item.kind === "file" ? <FileVideo url={item.url} label={label} active={playbackActive} /> : null;
}
