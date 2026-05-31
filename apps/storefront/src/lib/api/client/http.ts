import { resolveApiBase } from "@capella/shared/api/base";
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

export async function getJSON<T>(path: string, options?: { lang?: string }): Promise<T> {
  const resolvedLang = resolveFetchLanguage(options?.lang);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 300 },
      headers: resolvedLang ? { "x-lang": resolvedLang } : undefined
    });
  } catch (error) {
    if (isConnectionFailure(error)) {
      return null as T;
    }
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) {
      return null as T;
    }
    throw new Error(`API ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}

export async function authedGetJSON<T>(path: string, accessToken: string): Promise<T> {
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
      return null as T;
    }
    throw error;
  }
  if (!response.ok) {
    if (response.status === 404) {
      return null as T;
    }
    throw new Error(`API ${response.status} ${path}`);
  }
  return response.json() as Promise<T>;
}
