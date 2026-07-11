import { resolveApiBase } from "@capella/shared/api/base";
import { showErrorToast } from "@/lib/errors";

export const API_BASE = resolveApiBase();

export type AdminAuthUser = {
  name: string;
  email: string;
  role: "admin" | "staff";
  permissionKeys: string[];
};

export type ErpUploadContext =
  | "products.create"
  | "products.update"
  | "categories.create"
  | "categories.update"
  | "offers.create"
  | "offers.update"
  | "collections.create"
  | "collections.update"
  | "advices.create"
  | "advices.update"
  | "shop_media.update";

let adminAccessToken: string | null = null;
const adminAccessTokenListeners = new Set<(token: string | null) => void>();
let adminAuthHydrated = false;
const adminAuthHydrationListeners = new Set<(hydrated: boolean) => void>();
let adminAuthUser: AdminAuthUser | null = null;
const adminAuthUserListeners = new Set<(user: AdminAuthUser | null) => void>();
const adminSessionInvalidationListeners = new Set<() => void>();
let adminRefreshPromise: Promise<string | null> | null = null;
let adminRefreshTimer: number | null = null;

export function setAdminAccessToken(token: string | null) {
  adminAccessToken = token;
  scheduleAdminRefresh(token);
  adminAccessTokenListeners.forEach((listener) => listener(token));
}

export function subscribeAdminAccessToken(listener: (token: string | null) => void) {
  adminAccessTokenListeners.add(listener);
  return () => adminAccessTokenListeners.delete(listener);
}

export function setAdminAuthHydrated(hydrated: boolean) {
  adminAuthHydrated = hydrated;
  adminAuthHydrationListeners.forEach((listener) => listener(hydrated));
}

export function setAdminAuthUser(user: AdminAuthUser | null) {
  adminAuthUser = user;
  adminAuthUserListeners.forEach((listener) => listener(user));
}

export function getAdminAuthUser() {
  return adminAuthUser;
}

function invalidateAdminSession() {
  if (adminRefreshTimer) {
    clearTimeout(adminRefreshTimer);
    adminRefreshTimer = null;
  }
  setAdminAccessToken(null);
  setAdminAuthUser(null);
  adminSessionInvalidationListeners.forEach((listener) => listener());
}

function decodeTokenExpiryMs(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

function scheduleAdminRefresh(token: string | null) {
  if (adminRefreshTimer) {
    clearTimeout(adminRefreshTimer);
    adminRefreshTimer = null;
  }
  if (!token || typeof window === "undefined") {
    return;
  }

  const expiryMs = decodeTokenExpiryMs(token);
  if (!expiryMs) {
    return;
  }

  const refreshInMs = Math.max(expiryMs - Date.now() - 60_000, 5_000);
  adminRefreshTimer = window.setTimeout(() => {
    void refreshAdminSession();
  }, refreshInMs);
}

async function refreshAdminSession(): Promise<string | null> {
  if (adminRefreshPromise) {
    return adminRefreshPromise;
  }

  adminRefreshPromise = (async () => {
    const response = await fetch(`${API_BASE}/api/erp/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      invalidateAdminSession();
      return null;
    }

    const data = await response.json() as { accessToken?: string | null; user?: AdminAuthUser | null };
    setAdminAccessToken(data.accessToken ?? null);
    setAdminAuthUser(data.user ?? null);
    return data.accessToken ?? null;
  })();

  try {
    return await adminRefreshPromise;
  } catch {
    invalidateAdminSession();
    return null;
  } finally {
    adminRefreshPromise = null;
  }
}

export function isAdminAuthHydrated() {
  return adminAuthHydrated;
}

export function subscribeAdminAuthHydration(listener: (hydrated: boolean) => void) {
  adminAuthHydrationListeners.add(listener);
  return () => adminAuthHydrationListeners.delete(listener);
}

export function subscribeAdminAuthUser(listener: (user: AdminAuthUser | null) => void) {
  adminAuthUserListeners.add(listener);
  return () => adminAuthUserListeners.delete(listener);
}

export function subscribeAdminSessionInvalidation(listener: () => void) {
  adminSessionInvalidationListeners.add(listener);
  return () => adminSessionInvalidationListeners.delete(listener);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function request<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (adminAccessToken) headers.set("authorization", `Bearer ${adminAccessToken}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch {}
    const message = body && typeof body === "object" && "message" in body ? (body as { message?: unknown }).message : undefined;
    if (res.status === 401 && message === "Invalid admin token") {
      if (allowRefresh) {
        const refreshedToken = await refreshAdminSession();
        if (refreshedToken) {
          return request<T>(path, init, false);
        }
      } else {
        invalidateAdminSession();
      }
    }
    const err = new Error(`API ${res.status} ${path}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    showErrorToast(err);
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  uploadMedia: (file: File, context?: ErpUploadContext) =>
    file.arrayBuffer().then((buffer) =>
      request<{ url: string; path: string; fileName: string }>("/api/erp/uploads", {
        method: "POST",
        headers: context ? { "x-capella-upload-context": context } : undefined,
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          contentBase64: arrayBufferToBase64(buffer)
        })
      })
    ),
  uploadImage: (file: File, context?: ErpUploadContext) =>
    file.arrayBuffer().then((buffer) =>
      request<{ url: string; path: string; fileName: string }>("/api/erp/uploads", {
        method: "POST",
        headers: context ? { "x-capella-upload-context": context } : undefined,
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          contentBase64: arrayBufferToBase64(buffer)
        })
      })
    )
};
