import { resolveApiBase } from "@capella/shared/api/base";
import { getCurrentAccessToken, refreshAccessTokenOrNull } from "../../auth-provider.api";
import type { FetchLanguage } from "./types";

export const API_BASE = resolveApiBase();

function resolveFetchLanguage(lang?: string): FetchLanguage | undefined {
  if (lang === "ar" || lang === "en") {
    return lang;
  }

  if (typeof document !== "undefined") {
    const documentLang = document.documentElement.lang;
    if (documentLang === "ar" || documentLang === "en") {
      return documentLang;
    }
  }

  return undefined;
}

function isConnectionFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

export async function getJSON<T>(
  path: string,
  options?: { lang?: string; throwOnError?: boolean }
): Promise<T | null> {
  const resolvedLang = resolveFetchLanguage(options?.lang);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 10 },
      headers: resolvedLang ? { "x-lang": resolvedLang } : undefined
    });
  } catch (error) {
    // By default a connection failure is swallowed so SSR pages render empty
    // gracefully. Callers that must distinguish "down" from "no data" opt in.
    if (isConnectionFailure(error) && !options?.throwOnError) {
      return null;
    }
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`API ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

export async function authedGetJSON<T>(path: string, accessToken: string, allowRefresh = true): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });
  } catch (error) {
    if (isConnectionFailure(error)) {
      return null;
    }
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    if (response.status === 401 && allowRefresh) {
      const refreshedToken = await refreshAccessTokenOrNull();
      const retryToken = refreshedToken ?? getCurrentAccessToken();
      if (retryToken) {
        return authedGetJSON<T>(path, retryToken, false);
      }
    }
    throw new Error(`API ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

export async function authedMutationJSON<T>(
  path: string,
  accessToken: string,
  init: { method: "POST" | "DELETE"; body?: unknown },
  allowRefresh = true
): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  if (response.status === 204) return null;
  if (response.status === 401 && allowRefresh) {
    const refreshedToken = await refreshAccessTokenOrNull();
    const retryToken = refreshedToken ?? getCurrentAccessToken();
    if (retryToken) return authedMutationJSON<T>(path, retryToken, init, false);
  }
  const data = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(data?.message ?? `API ${response.status} ${path}`);
  return data as T;
}
