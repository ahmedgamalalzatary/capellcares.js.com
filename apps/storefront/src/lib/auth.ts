"use client";

import type { Customer, LoginRequestDto, SignupRequestDto } from "@minikoshk/shared";
import { ApiError, apiSend } from "./api/client";

/**
 * Customer auth against `POST /api/v1/auth/*`. The refresh token is an
 * HTTP-only cookie managed by the API; only the short-lived access token and
 * the user snapshot are kept client-side.
 */

const AUTH_KEY = "minikoshk_auth";
export const AUTH_UPDATED_EVENT = "minikoshk:auth-updated";

export interface AuthState {
  accessToken: string;
  user: Customer;
}

export function readAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_KEY) ?? "null") as AuthState | null;
    if (
      stored != null &&
      typeof stored.accessToken === "string" &&
      stored.user != null &&
      typeof stored.user.id === "number"
    ) {
      return stored;
    }
  } catch {
    // Corrupt storage — treat as signed out.
  }
  return null;
}

function writeAuth(state: AuthState | null): void {
  if (state) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(AUTH_KEY);
  }
  window.dispatchEvent(new CustomEvent(AUTH_UPDATED_EVENT, { detail: state }));
}

export async function login(credentials: LoginRequestDto): Promise<AuthState> {
  const result = await apiSend<{ accessToken: string; user: Customer }>("/auth/login", { body: credentials });
  const state: AuthState = { accessToken: result.accessToken, user: result.user };
  writeAuth(state);
  return state;
}

/** Signup does not issue tokens, so we log the new account straight in. */
export async function signup(details: SignupRequestDto): Promise<AuthState> {
  await apiSend<{ user: Customer }>("/auth/signup", { body: details });
  return login({ email: details.email, password: details.password });
}

/** Rotate the access token off the refresh cookie; clears auth if the session died. */
export async function refreshSession(): Promise<AuthState | null> {
  const current = readAuth();
  if (!current) return null;
  try {
    const result = await apiSend<{ accessToken: string }>("/auth/refresh");
    const state: AuthState = { ...current, accessToken: result.accessToken };
    writeAuth(state);
    return state;
  } catch {
    writeAuth(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiSend<void>("/auth/logout");
  } finally {
    writeAuth(null);
    // The wishlist is account-scoped once synced; leaving it behind would leak
    // this user's items into the next account that logs in on this browser.
    localStorage.removeItem("minikoshk_wishlist");
    window.dispatchEvent(new CustomEvent("minikoshk:wishlist-updated", { detail: [] }));
  }
}

/**
 * `apiSend` with the current access token, transparently retrying once through
 * the refresh cookie when the token has expired (customer access tokens live
 * ~15 minutes). If the refresh fails the request is retried unauthenticated so
 * flows that allow guests (checkout) still succeed.
 */
export async function apiSendAuthed<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const auth = readAuth();
  try {
    return await apiSend<T>(path, { ...options, accessToken: auth?.accessToken ?? null });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || !auth) {
      throw error;
    }
    const refreshed = await refreshSession();
    return apiSend<T>(path, { ...options, accessToken: refreshed?.accessToken ?? null });
  }
}
