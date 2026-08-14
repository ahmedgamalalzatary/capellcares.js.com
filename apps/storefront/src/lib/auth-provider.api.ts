import type { AuthUser } from "../types/auth-provider.types";
import { PUBLIC_API_BASE as API_BASE } from "@/constants/api";
let currentAccessToken: string | null = null;
let sessionRevision = 0;
type RefreshState = {
  controller: AbortController;
  promise: Promise<string | null>;
  revision: number;
};
let refreshState: RefreshState | null = null;
const accessTokenListeners = new Set<(token: string | null) => void>();

export function setCurrentAccessToken(token: string | null) {
  currentAccessToken = token;
  accessTokenListeners.forEach((listener) => listener(token));
}

export function getCurrentAccessToken() {
  return currentAccessToken;
}

export function getAuthSessionRevision() {
  return sessionRevision;
}

function advanceAuthSession() {
  sessionRevision += 1;
  refreshState?.controller.abort();
  refreshState = null;
}

export function subscribeCurrentAccessToken(listener: (token: string | null) => void) {
  accessTokenListeners.add(listener);
  return () => accessTokenListeners.delete(listener);
}

export async function refreshAccessToken(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    signal
  });
  return response;
}

export async function refreshAccessTokenOrNull(): Promise<string | null> {
  if (refreshState) {
    return refreshState.promise;
  }

  const state = {
    controller: new AbortController(),
    promise: null as unknown as Promise<string | null>,
    revision: sessionRevision
  } satisfies RefreshState;
  state.promise = (async () => {
    try {
      const response = await refreshAccessToken(state.controller.signal);
      if (sessionRevision !== state.revision) return null;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          advanceAuthSession();
          setCurrentAccessToken(null);
        }
        return null;
      }

      const data = await response.json() as { accessToken?: string | null };
      if (sessionRevision !== state.revision) return null;
      const token = data.accessToken ?? null;
      setCurrentAccessToken(token);
      return token;
    } catch {
      return null;
    } finally {
      if (refreshState === state) {
        refreshState = null;
      }
    }
  })();
  refreshState = state;
  return state.promise;
}

export async function loginRequest(email: string, password: string): Promise<{ user: AuthUser; accessToken: string | null }> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    throw new Error("Login failed");
  }
  const data = await response.json() as { user: AuthUser; accessToken: string | null };
  advanceAuthSession();
  setCurrentAccessToken(data.accessToken);
  return data;
}

export async function signupRequest(name: string, email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password })
  });
  if (!response.ok) {
    throw new Error("Signup failed");
  }
}

export async function logoutRequest() {
  advanceAuthSession();
  setCurrentAccessToken(null);
  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
}
