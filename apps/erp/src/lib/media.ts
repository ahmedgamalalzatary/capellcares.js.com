import { API_BASE } from "@/lib/api/client";

/** Stored media may be a relative `/uploads/...` path, which resolves against the API origin. */
export function resolveMediaSrc(value: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${API_BASE}${value}`;
  return value;
}
