import { Platform } from "react-native";

const ANDROID_EMULATOR_API_BASE = "http://10.0.2.2:4000";
const IOS_SIMULATOR_API_BASE = "http://localhost:4000";

const API_BASE_PATTERN = /^(https?):\/\/([^\s/?#@]+)(\/[^\s?#]*)?$/i;

function normalizeConfiguredApiBase(
  configuredBase: string,
  isDevelopment: boolean
): string {
  const match = API_BASE_PATTERN.exec(configuredBase);
  if (!match) {
    throw new Error(
      "EXPO_PUBLIC_API_URL must be an absolute http(s) URL with a host and no credentials, query or hash"
    );
  }

  if (!isDevelopment && match[1].toLowerCase() !== "https") {
    throw new Error(
      "EXPO_PUBLIC_API_URL must use https outside development"
    );
  }

  return configuredBase.replace(/\/+$/, "");
}

export function resolveMobileApiBase(
  configuredUrl: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  platform: string = Platform.OS,
  isDevelopment: boolean = __DEV__
): string {
  const configuredBase = configuredUrl?.trim();
  if (configuredBase) {
    return normalizeConfiguredApiBase(configuredBase, isDevelopment);
  }

  if (!isDevelopment) {
    throw new Error("EXPO_PUBLIC_API_URL is required outside development");
  }

  return platform === "android"
    ? ANDROID_EMULATOR_API_BASE
    : IOS_SIMULATOR_API_BASE;
}

export const API_BASE = resolveMobileApiBase();
