import { resolveApiBase } from "./base";

export const API_BASE = resolveApiBase();

let adminAccessToken: string | null = null;

export function setAdminAccessToken(token: string | null) {
  adminAccessToken = token;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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
    const err = new Error(`API ${res.status} ${path}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  uploadImage: (file: File) =>
    file.arrayBuffer().then((buffer) =>
      request<{ url: string; path: string; fileName: string }>("/api/erp/uploads", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          contentBase64: arrayBufferToBase64(buffer)
        })
      })
    )
};
