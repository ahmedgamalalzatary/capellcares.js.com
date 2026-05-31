import type { AuthUser } from "../auth-provider.types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function refreshAccessToken() {
  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include"
  });
  return response;
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
  return response.json() as Promise<{ user: AuthUser; accessToken: string | null }>;
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
}
