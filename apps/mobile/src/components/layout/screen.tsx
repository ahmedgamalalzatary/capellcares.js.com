import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme";
export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const content = [ { padding: spacing.xlarge, gap: spacing.xlarge, flexGrow: 1 }, style ];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}><KeyboardAvoidingView
    style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    {scroll ? <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView>
      : <View style={content}>{children}</View>}
  </KeyboardAvoidingView></SafeAreaView>;
}
