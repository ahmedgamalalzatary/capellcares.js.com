import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LangProvider } from "@/lib/lang";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </LangProvider>
    </SafeAreaProvider>
  );
}
