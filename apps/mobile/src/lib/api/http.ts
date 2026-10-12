import { API_BASE } from "./base";
import { nativeRequestHeaders } from "./identity";
import { appUpdateRequiredSchema, type AppFeature, type AppUpdateRequired } from "@capella/shared";
import type { FetchLanguage } from "./types";

type AuthSessionAdapter = {
  getAccessToken: () => string | null;
  getSessionRevision: () => number;
  refreshAccessToken: () => Promise<string | null>;
  ownsToken?: (token: string) => boolean;
};

type RequestSession = {
  adapter: AuthSessionAdapter;
  revision: number;
  ownsToken: boolean;
};

type RequestOptions = {
  lang?: FetchLanguage;
  retryOn401?: boolean;
  refreshToken?: string;
};

let authSessionAdapter: AuthSessionAdapter | null = null;

export const API_REQUEST_TIMEOUT_MS = 15_000;

export function configureAuthSessionAdapter(adapter: AuthSessionAdapter | null) {
  authSessionAdapter = adapter;
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

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly feature?: AppFeature;
  readonly updateRequired?: AppUpdateRequired;

  constructor(status: number, message: string, code?: string, updateRequired?: AppUpdateRequired) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.feature = updateRequired?.feature;
    this.updateRequired = updateRequired;
  }
}

type ErrorEnvelope = {
  message?: unknown;
  error?: unknown;
  code?: unknown;
};

async function apiError(response: Response, path: string): Promise<ApiError> {
  const data = (await response.json().catch(() => null)) as ErrorEnvelope | null;
  const envelope = typeof data === "object" && data !== null ? data : {};
  const message =
    typeof envelope.message === "string"
      ? envelope.message
      : typeof envelope.error === "string"
        ? envelope.error
        : `API ${response.status} ${path}`;
  const code = typeof envelope.code === "string" ? envelope.code : undefined;
  const update = appUpdateRequiredSchema.safeParse(envelope);
  return new ApiError(response.status, message, code, update.success ? update.data : undefined);
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
  if (!body.trim()) return null;
  try { return JSON.parse(body) as T; } catch {
    throw new ApiError(response.status, "Invalid API response", "INVALID_PAYLOAD");
  }
}

function captureRequestSession(accessToken: string | null): RequestSession | null {
  if (!authSessionAdapter) {
    return null;
  }
  const adapter = authSessionAdapter;
  const ownsToken =
    accessToken !== null &&
    (adapter.ownsToken
      ? adapter.ownsToken(accessToken)
      : adapter.getAccessToken() === accessToken);
  return { adapter, revision: adapter.getSessionRevision(), ownsToken };
}

function assertCurrentSession(session: RequestSession | null) {
  if (session?.ownsToken && (authSessionAdapter !== session.adapter ||
    session.adapter.getSessionRevision() !== session.revision)) {
    throw new ApiError(401, "The signed-in session changed", "SESSION_CHANGED");
  }
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

  if (!requestSession.ownsToken) {
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
      headers: nativeRequestHeaders(path, options.lang)
    });
    const { response } = request;

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw await apiError(response, path);
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
        ...nativeRequestHeaders(path, options.lang)
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
      throw await apiError(response, path);
    }
    const data = await successfulJSON<T>(response);
    assertCurrentSession(requestSession);
    return data;
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
    captureRequestSession(accessToken)
  );
}

type MutationInit = {
  method: "POST" | "DELETE" | "PUT";
  body?: unknown;
  idempotencyKey?: string;
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
      ...nativeRequestHeaders(path, options.lang),
      ...(options.refreshToken ? { "x-refresh-token": options.refreshToken } : {}),
      ...(init.idempotencyKey ? { "idempotency-key": init.idempotencyKey } : {}),
      ...(init.body === undefined ? {} : { "content-type": "application/json" })
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });
  const { response } = request;

  try {
    if (response.status === 204) {
      assertCurrentSession(requestSession);
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
      throw await apiError(response, path);
    }
    const data = await successfulJSON<T>(response);
    assertCurrentSession(requestSession);
    return data;
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
    captureRequestSession(accessToken)
  );
}

export function authJSON<T>(action: "login" | "signup" | "refresh" | "logout", body?: unknown,
  options: { lang?: FetchLanguage; refreshToken?: string } = {}): Promise<T | null> {
  return authedMutationJSON(`/api/v1/auth/${action}`, null, { method: "POST", body },
    { ...options, retryOn401: false });
}
