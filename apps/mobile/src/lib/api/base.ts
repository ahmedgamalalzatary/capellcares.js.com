import { Platform } from "react-native";

const ANDROID_EMULATOR_API_BASE = "http://10.0.2.2:4000";
const IOS_SIMULATOR_API_BASE = "http://localhost:4000";

export function resolveMobileApiBase(
  configuredUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  platform: string = Platform.OS,
  isDevelopment: boolean = __DEV__
): string {
  const configuredBase = configuredUrl?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/+$/, "");
  }

  if (!isDevelopment) {
    throw new Error("EXPO_PUBLIC_API_URL is required outside development");
  }

  return platform === "android"
    ? ANDROID_EMULATOR_API_BASE
    : IOS_SIMULATOR_API_BASE;
}

export const API_BASE = resolveMobileApiBase();
