import { Lobster_400Regular } from "@expo-google-fonts/lobster/400Regular";
import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { Tajawal_400Regular } from "@expo-google-fonts/tajawal/400Regular";
import { Tajawal_500Medium } from "@expo-google-fonts/tajawal/500Medium";
import { Tajawal_700Bold } from "@expo-google-fonts/tajawal/700Bold";
import { useFonts } from "expo-font";
import { reloadAppAsync } from "expo";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LangProvider, useLang } from "@/lib/lang";
import { AuthProvider } from "@/lib/auth/auth-context";
import { PolicyProvider } from "@/lib/policy";
import { CartProvider } from "@/lib/cart";
import { colors, spacing } from "@/theme";

void SplashScreen.preventAutoHideAsync().catch(() => {
  console.error("Unable to hold the startup splash screen.");
});

const startupCopy = {
  ar: {
    fonts: "تعذر تحميل خطوط التطبيق.",
    language: "تعذر إعداد لغة التطبيق.",
    restart: "تعذر إعادة تشغيل التطبيق. حاول مرة أخرى.",
    retry: "حاول مرة أخرى"
  },
  en: {
    fonts: "Unable to load app fonts.",
    language: "Unable to prepare app language.",
    restart: "Unable to restart the app. Please try again.",
    retry: "Try again"
  }
};

function RootNavigator({ fontsLoaded, fontError }: { fontsLoaded: boolean; fontError: Error | null }) {
  const { ready: languageReady, error: languageError, lang, retry: retryLanguage } = useLang();
  const [restartFailed, setRestartFailed] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const restartingRef = useRef(false);
  const copy = startupCopy[lang];
  const startupSettled = languageError !== null || (languageReady && (fontsLoaded || fontError !== null));

  useEffect(() => {
    if (startupSettled) {
      void SplashScreen.hideAsync().catch(() => {
        console.error("Unable to hide the startup splash screen.");
      });
    }
  }, [startupSettled]);

  const retryStartup = async () => {
    if (languageError) {
      retryLanguage();
      return;
    }
    if (restartingRef.current) return;
    restartingRef.current = true;
    setRestarting(true);
    setRestartFailed(false);
    try {
      await reloadAppAsync();
    } catch {
      setRestartFailed(true);
    } finally {
      restartingRef.current = false;
      setRestarting(false);
    }
  };

  if (!startupSettled) return null;
  if (languageError || fontError) {
    return (
      <View style={styles.startupError}>
        <Text accessibilityRole="alert" style={styles.startupErrorText}>
          {restartFailed ? copy.restart : languageError ? copy.language : copy.fonts}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: restarting, busy: restarting }}
          disabled={restarting}
          onPress={() => void retryStartup()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>{copy.retry}</Text>
        </Pressable>
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
        <AuthProvider>
          <PolicyProvider>
            <CartProvider>
              <RootNavigator fontsLoaded={fontsLoaded} fontError={fontError} />
            </CartProvider>
          </PolicyProvider>
        </AuthProvider>
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
  },
  retryButton: {
    backgroundColor: colors.accent,
    marginTop: spacing.large,
    minHeight: 48,
    minWidth: 48,
    justifyContent: "center",
    padding: spacing.large
  },
  retryText: {
    color: colors.surface,
    fontSize: 16,
    textAlign: "center"
  }
});
