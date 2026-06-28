// Global API defaults.

export const DEFAULT_API_BASE = "http://localhost:4000";

function resolvePublicApiBase() {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (value) return value;
  if (process.env.NODE_ENV !== "production") return DEFAULT_API_BASE;
  throw new Error("NEXT_PUBLIC_API_URL must be set in production");
}

export const PUBLIC_API_BASE = resolvePublicApiBase();

// Dev-only fallback for the storefront revalidation secret. Production must set
// STOREFRONT_REVALIDATE_SECRET explicitly (see resolveRevalidateSecret).
export const DEV_REVALIDATE_SECRET = "dev-revalidate-secret";
