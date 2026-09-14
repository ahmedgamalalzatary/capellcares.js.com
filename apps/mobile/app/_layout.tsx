import { Lobster_400Regular } from "@expo-google-fonts/lobster/400Regular";
import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { Tajawal_400Regular } from "@expo-google-fonts/tajawal/400Regular";
import { Tajawal_500Medium } from "@expo-google-fonts/tajawal/500Medium";
import { Tajawal_700Bold } from "@expo-google-fonts/tajawal/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LangProvider, useLang } from "@/lib/lang";
import { colors, spacing } from "@/theme";

void SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsLoaded, fontError }: { fontsLoaded: boolean; fontError: Error | null }) {
  const { ready: languageReady } = useLang();
  const startupSettled = languageReady && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (startupSettled) void SplashScreen.hideAsync();
  }, [startupSettled]);

  if (!languageReady || (!fontsLoaded && fontError === null)) return null;
  if (fontError) {
    return (
      <View accessible accessibilityRole="alert" style={styles.startupError}>
        <Text style={styles.startupErrorText}>Unable to load app fonts.</Text>
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lobster_400Regular,
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold
  });

  return (
    <SafeAreaProvider>
      <LangProvider>
        <RootNavigator fontsLoaded={fontsLoaded} fontError={fontError} />
      </LangProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  startupError: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: "center",
    padding: spacing.xlarge
  },
  startupErrorText: {
    color: colors.error,
    fontSize: 16,
    textAlign: "center"
  }
});
