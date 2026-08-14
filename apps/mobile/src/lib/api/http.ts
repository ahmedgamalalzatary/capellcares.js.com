import { API_BASE } from "./base";
import type { FetchLanguage } from "./types";

type AuthSessionAdapter = {
  getAccessToken: () => string | null;
  getSessionRevision: () => number;
  refreshAccessToken: () => Promise<string | null>;
};

type RequestSession = {
  adapter: AuthSessionAdapter;
  revision: number;
};

type RequestOptions = {
  lang?: FetchLanguage;
  retryOn401?: boolean;
};

let authSessionAdapter: AuthSessionAdapter | null = null;

export const API_REQUEST_TIMEOUT_MS = 15_000;

export function configureAuthSessionAdapter(adapter: AuthSessionAdapter | null) {
  authSessionAdapter = adapter;
}

function languageHeaders(lang?: FetchLanguage): Record<string, string> {
  return lang ? { "x-lang": lang } : {};
}

function isConnectionFailure(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

async function errorMessage(response: Response, path: string): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  return data?.message ?? `API ${response.status} ${path}`;
}

type TimedResponse = {
  response: Response;
  release: () => void;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<TimedResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      clearTimeout(timeout);
    }
  };

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return { response, release };
  } catch (error) {
    release();
    throw error;
  }
}

async function successfulJSON<T>(response: Response): Promise<T | null> {
  if (response.status === 204) return null;
  const body = await response.text();
  return body.trim() ? (JSON.parse(body) as T) : null;
}

function captureRequestSession(): RequestSession | null {
  return authSessionAdapter
    ? {
        adapter: authSessionAdapter,
        revision: authSessionAdapter.getSessionRevision()
      }
    : null;
}

async function retryToken(
  requestSession: RequestSession | null,
  failedToken: string
): Promise<string | null> {
  if (
    !requestSession ||
    authSessionAdapter !== requestSession.adapter ||
    requestSession.adapter.getSessionRevision() !== requestSession.revision
  ) {
    return null;
  }

  const currentToken = requestSession.adapter.getAccessToken();
  if (currentToken && currentToken !== failedToken) {
    return currentToken;
  }

  const refreshedToken = await requestSession.adapter.refreshAccessToken();
  if (
    authSessionAdapter !== requestSession.adapter ||
    requestSession.adapter.getSessionRevision() !== requestSession.revision
  ) {
    return null;
  }
  const fallbackToken = refreshedToken ?? requestSession.adapter.getAccessToken();
  return fallbackToken && fallbackToken !== failedToken ? fallbackToken : null;
}

export async function getJSON<T>(
  path: string,
  options: { lang?: FetchLanguage; throwOnError?: boolean } = {}
): Promise<T | null> {
  let request: TimedResponse | null = null;
  try {
    request = await fetchWithTimeout(`${API_BASE}${path}`, {
      headers: options.lang ? languageHeaders(options.lang) : undefined
    });
    const { response } = request;

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(await errorMessage(response, path));
    }
    return await successfulJSON<T>(response);
  } catch (error) {
    if (isConnectionFailure(error) && !options.throwOnError) {
      return null;
    }
    throw error;
  } finally {
    request?.release();
  }
}

async function authedGetJSONInternal<T>(
  path: string,
  accessToken: string,
  options: RequestOptions,
  allowRefresh: boolean,
  requestSession: RequestSession | null
): Promise<T | null> {
  let request: TimedResponse | null = null;
  try {
    request = await fetchWithTimeout(`${API_BASE}${path}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...languageHeaders(options.lang)
      }
    });
    const { response } = request;

    if (response.status === 404) {
      return null;
    }
    if (response.status === 401 && allowRefresh && options.retryOn401 !== false) {
      request.release();
      const token = await retryToken(requestSession, accessToken);
      if (token) {
        return await authedGetJSONInternal(path, token, options, false, requestSession);
      }
    }
    if (!response.ok) {
      throw new Error(await errorMessage(response, path));
    }
    return await successfulJSON<T>(response);
  } finally {
    request?.release();
  }
}

export function authedGetJSON<T>(
  path: string,
  accessToken: string,
  options: RequestOptions = {}
): Promise<T | null> {
  return authedGetJSONInternal(
    path,
    accessToken,
    options,
    true,
    captureRequestSession()
  );
}

type MutationInit = {
  method: "POST" | "DELETE";
  body?: unknown;
};

async function authedMutationJSONInternal<T>(
  path: string,
  accessToken: string | null,
  init: MutationInit,
  options: RequestOptions,
  allowRefresh: boolean,
  requestSession: RequestSession | null
): Promise<T | null> {
  const request = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: init.method,
    headers: {
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...languageHeaders(options.lang),
      ...(init.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const { response } = request;

  try {
    if (response.status === 204) {
      return null;
    }
    if (
      response.status === 401 &&
      accessToken &&
      allowRefresh &&
      options.retryOn401 !== false
    ) {
      request.release();
      const token = await retryToken(requestSession, accessToken);
      if (token) {
        return await authedMutationJSONInternal(
          path,
          token,
          init,
          options,
          false,
          requestSession
        );
      }
    }
    if (!response.ok) {
      throw new Error(await errorMessage(response, path));
    }
    return await successfulJSON<T>(response);
  } finally {
    request.release();
  }
}

export function authedMutationJSON<T>(
  path: string,
  accessToken: string | null,
  init: MutationInit,
  options: RequestOptions = {}
): Promise<T | null> {
  return authedMutationJSONInternal(
    path,
    accessToken,
    init,
    options,
    true,
    captureRequestSession()
  );
}
