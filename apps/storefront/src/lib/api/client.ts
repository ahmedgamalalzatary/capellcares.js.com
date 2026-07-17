import { resolveApiBase } from "@minikoshk/shared/api/base";

/**
 * Single place the storefront resolves the API origin. On the server we prefer
 * API_INTERNAL_URL (docker network); in the browser the base is derived from
 * the current hostname.
 */
export function apiBase(): string {
  return resolveApiBase(process.env);
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // Non-JSON error body — fall through to the status text.
  }
  return response.statusText || `Request failed (${response.status})`;
}

/**
 * GET a storefront API resource. Returns `null` on 404 and throws `ApiError`
 * on any other failure so callers can distinguish "missing" from "broken".
 *
 * On the server the response enters Next's data cache (`force-cache`) and is
 * invalidated by `/api/revalidate` when the admin changes the catalog; in the
 * browser (cart/wishlist resolution) it's always fetched fresh.
 */
export async function apiGet<T>(path: string, init?: RequestInit): Promise<T | null> {
  const cache: RequestCache = typeof window === "undefined" ? "force-cache" : "no-store";
  const response = await fetch(`${apiBase()}/api/v1${path}`, { cache, ...init });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }
  return (await response.json()) as T;
}

/** Like `apiGet` but swallows every failure into a fallback — for list pages that should render empty rather than crash. */
export async function apiGetOr<T>(path: string, fallback: T): Promise<T> {
  try {
    return (await apiGet<T>(path)) ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Mutating call (POST by default). Sends/receives JSON, includes cookies (the
 * customer refresh token lives in an HTTP-only cookie), and attaches the
 * Bearer access token when one is provided.
 */
export async function apiSend<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; accessToken?: string | null } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }
  const response = await fetch(`${apiBase()}/api/v1${path}`, {
    method: options.method ?? "POST",
    headers,
    credentials: "include",
    cache: "no-store",
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    throw new ApiError(await extractErrorMessage(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
