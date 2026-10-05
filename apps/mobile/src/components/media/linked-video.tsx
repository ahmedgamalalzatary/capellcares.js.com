import { WebView } from "react-native-webview";
import { View } from "react-native";
export function LinkedVideo({ url, label, onError }: { url: string; label: string; onError: () => void }) {
  return <View style={{ aspectRatio: 16 / 9, width: "100%" }}>
    <WebView source={{ uri: url }} accessibilityLabel={label} originWhitelist={["https://*"]}
      allowsFullscreenVideo mediaPlaybackRequiresUserAction allowsInlineMediaPlayback mixedContentMode="never"
      setSupportMultipleWindows={false} onOpenWindow={() => {}} onError={onError} onHttpError={onError}
      onShouldStartLoadWithRequest={request => request.url === "about:blank" || request.url === url}
      style={{ flex: 1 }} />
  </View>;
}
