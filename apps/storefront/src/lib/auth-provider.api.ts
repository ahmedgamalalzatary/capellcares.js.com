import type { AuthUser } from "../types/auth-provider.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
let currentAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
const accessTokenListeners = new Set<(token: string | null) => void>();

export function setCurrentAccessToken(token: string | null) {
  currentAccessToken = token;
  accessTokenListeners.forEach((listener) => listener(token));
}

export function getCurrentAccessToken() {
  return currentAccessToken;
}

export function subscribeCurrentAccessToken(listener: (token: string | null) => void) {
  accessTokenListeners.add(listener);
  return () => accessTokenListeners.delete(listener);
}

export async function refreshAccessToken() {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });
  return response;
}

export async function refreshAccessTokenOrNull(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await refreshAccessToken();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setCurrentAccessToken(null);
        }
        return null;
      }

      const data = await response.json() as { accessToken?: string | null };
      const token = data.accessToken ?? null;
      setCurrentAccessToken(token);
      return token;
    } catch {
        setCurrentAccessToken(null);
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
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
  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  setCurrentAccessToken(null);
}
