import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Updates from "expo-updates";
import { nativeClientIdentitySchema } from "@capella/shared";
import type { FetchLanguage } from "./types";

// Increment only when this JavaScript release changes a required capability.
// OTA UUIDs identify executing bundles; they cannot be ordered as versions.
export const CLIENT_REVISION = 1;

export class NativeIdentityError extends Error {
  readonly code = "INVALID_APP_METADATA";
  constructor() { super("Native app identity is unavailable"); this.name = "NativeIdentityError"; }
}

export function nativeRequestHeaders(path: string, lang?: FetchLanguage): Record<string, string> {
  const headers: Record<string, string> = lang ? { "x-lang": lang } : {};
  if (Platform.OS !== "android" && Platform.OS !== "ios") return headers;
  if (path.startsWith("/api/v1/auth/")) headers["x-client"] = "mobile";
  // Expo Go and Metro do not execute a production update/runtime. Development
  // requests may exercise the API without claiming an installed store identity.
  if (__DEV__) return headers;
  const identity = nativeClientIdentitySchema.safeParse({
    platform: Platform.OS, appVersion: Application.nativeApplicationVersion,
    appBuild: Application.nativeBuildVersion, runtimeVersion: Updates.runtimeVersion,
    updateId: Updates.updateId ?? (Updates.isEmbeddedLaunch ? "embedded" : null),
    clientRevision: CLIENT_REVISION
  });
  if (!identity.success) throw new NativeIdentityError();
  return { ...headers,
    "x-app-version": identity.data.appVersion, "x-app-build": identity.data.appBuild,
    "x-platform": identity.data.platform, "x-runtime-version": identity.data.runtimeVersion,
    "x-update-id": identity.data.updateId, "x-client-revision": String(identity.data.clientRevision)
  };
}
