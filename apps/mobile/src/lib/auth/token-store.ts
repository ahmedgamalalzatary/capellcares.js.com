import * as SecureStore from "expo-secure-store";
import { ApiError, authJSON } from "@/lib/api/http";
import { CUSTOMER_REFRESH_TOKEN_KEY } from "@/constants/storage";

type AccessTokenListener = (token: string | null) => void;
type ClearedListener = () => void;

// The access token is intentionally kept in memory only: it is short-lived and
// never persisted. The refresh token is the durable credential and lives in SecureStore.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionRevision = 0;
let refreshInFlight: Promise<string | null> | null = null;
// Bumped whenever the session is cleared or replaced. A refresh that resolves after its
// epoch is stale must not persist or publish anything, or it would resurrect a cleared session.
let sessionEpoch = 0;

const accessListeners = new Set<AccessTokenListener>();
const clearedListeners = new Set<ClearedListener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function getSessionRevision(): number {
  return sessionRevision;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function ownsToken(token: string | null): boolean {
  return token !== null && token === accessToken;
}

export function subscribeAccessToken(listener: AccessTokenListener): () => void {
  accessListeners.add(listener);
  return () => {
    accessListeners.delete(listener);
  };
}

/** Notified when local credentials are cleared because the session was genuinely rejected or logged out. */
export function subscribeCleared(listener: ClearedListener): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}

function publishAccessToken(token: string | null): void {
  accessToken = token;
  accessListeners.forEach((listener) => listener(token));
}

async function storeRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(CUSTOMER_REFRESH_TOKEN_KEY, token);
}

async function loadStoredRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(CUSTOMER_REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Persist the refresh token durably before publishing the access token it belongs to. */
export async function setAuthenticatedSession(input: { accessToken: string; refreshToken?: string | null }): Promise<void> {
  // A new sign-in invalidates any refresh still in flight for the previous session.
  sessionEpoch += 1;
  refreshInFlight = null;
  if (typeof input.refreshToken === "string" && input.refreshToken.length > 0) {
    // Durable first, and before the identity changes: a failed keychain write leaves the previous session intact.
    await storeRefreshToken(input.refreshToken);
    refreshToken = input.refreshToken;
  }
  // Advance the identity and publish the token together, with no await between, so no request can observe the
  // new revision paired with the old token (the HTTP layer treats a revision change as an account swap).
  sessionRevision += 1;
  publishAccessToken(input.accessToken);
}

export async function clearSession(): Promise<void> {
  sessionEpoch += 1;
  sessionRevision += 1;
  refreshToken = null;
  refreshInFlight = null;
  try {
    await SecureStore.deleteItemAsync(CUSTOMER_REFRESH_TOKEN_KEY);
  } catch {
    // The in-memory session is cleared regardless of whether the keychain agrees.
  }
  publishAccessToken(null);
  clearedListeners.forEach((listener) => listener());
}

/** Single-flight refresh. Genuine rejection clears the session; a transient failure keeps it recoverable. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const epoch = sessionEpoch;
  refreshInFlight = (async () => {
    try {
      const token = refreshToken ?? (await loadStoredRefreshToken());
      if (!token) return null;

      const result = await authJSON<{ accessToken?: string; refreshToken?: string }>("refresh", undefined, {
        refreshToken: token
      });
      if (epoch !== sessionEpoch) return null;
      if (!result?.accessToken) return null;

      if (typeof result.refreshToken === "string" && result.refreshToken.length > 0) {
        // Durable first: if the keychain write fails, the rotated token is not adopted.
        await storeRefreshToken(result.refreshToken);
        if (epoch !== sessionEpoch) {
          // The session was cleared while the rotated token was being written; remove the resurrected credential.
          try {
            await SecureStore.deleteItemAsync(CUSTOMER_REFRESH_TOKEN_KEY);
          } catch {
            // Best effort.
          }
          return null;
        }
        refreshToken = result.refreshToken;
      }
      if (epoch !== sessionEpoch) return null;
      publishAccessToken(result.accessToken);
      return result.accessToken;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && epoch === sessionEpoch) {
        await clearSession();
      }
      return null;
    } finally {
      // Do not clobber a newer in-flight refresh that started after this one's session ended.
      if (epoch === sessionEpoch) refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Load the durable refresh token and attempt a silent refresh. Returns whether a session remains recoverable. */
export async function bootstrapSession(): Promise<boolean> {
  const stored = await loadStoredRefreshToken();
  if (!stored) return false;
  refreshToken = stored;
  await refreshAccessToken();
  return refreshToken !== null;
}

export const authSessionAdapter = {
  getAccessToken,
  getSessionRevision,
  refreshAccessToken,
  ownsToken
};
