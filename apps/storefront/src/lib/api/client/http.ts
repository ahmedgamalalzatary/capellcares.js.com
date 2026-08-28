import { resolveApiBase } from "@capella/shared/api/base";
import {
  getAuthSessionRevision,
  getCurrentAccessToken,
  refreshAccessTokenOrNull
} from "../../auth-provider.api";
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

async function resolveRetryToken(failedToken: string, revision: number) {
  if (getAuthSessionRevision() !== revision) return null;
  const currentToken = getCurrentAccessToken();
  if (currentToken && currentToken !== failedToken) return currentToken;

  const refreshedToken = await refreshAccessTokenOrNull();
  if (getAuthSessionRevision() !== revision) return null;
  return refreshedToken && refreshedToken !== failedToken ? refreshedToken : null;
}

async function authedGetJSONInternal<T>(
  path: string,
  accessToken: string,
  allowRefresh: boolean,
  revision: number
): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    if (response.status === 401 && allowRefresh) {
      const retryToken = await resolveRetryToken(accessToken, revision);
      if (retryToken) {
        return authedGetJSONInternal<T>(path, retryToken, false, revision);
      }
      if (getAuthSessionRevision() === revision) {
        throw new Error("Authentication refresh unavailable");
      }
    }
    throw new Error(`API ${response.status} ${path}`);
  }
  const data = await response.json() as T;
  if (getAuthSessionRevision() !== revision) {
    throw new Error("Authentication session changed");
  }
  return data;
}

export function authedGetJSON<T>(path: string, accessToken: string): Promise<T | null> {
  return authedGetJSONInternal(path, accessToken, true, getAuthSessionRevision());
}

async function authedMutationJSONInternal<T>(
  path: string,
  accessToken: string | null,
  init: { method: "POST" | "DELETE"; body?: unknown },
  allowRefresh: boolean,
  revision: number
): Promise<T | null> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: init.method,
    cache: "no-store",
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  if (response.status === 204) {
    if (accessToken && getAuthSessionRevision() !== revision) {
      throw new Error("Authentication session changed");
    }
    return null;
  }
  if (response.status === 401 && accessToken && allowRefresh) {
    const retryToken = await resolveRetryToken(accessToken, revision);
    if (retryToken) {
      return authedMutationJSONInternal<T>(path, retryToken, init, false, revision);
    }
    if (getAuthSessionRevision() === revision) {
      throw new Error("Authentication refresh unavailable");
    }
  }
  const data = await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(data?.message ?? `API ${response.status} ${path}`);
  if (accessToken && getAuthSessionRevision() !== revision) {
    throw new Error("Authentication session changed");
  }
  return data as T;
}


export function authedMutationJSON<T>(
  path: string,
  accessToken: string | null,
  init: { method: "POST" | "DELETE"; body?: unknown }
): Promise<T | null> {
  return authedMutationJSONInternal(
    path,
    accessToken,
    init,
    true,
    getAuthSessionRevision()
  );
}
