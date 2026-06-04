const DEV_DEFAULT_ORIGINS = ["http://localhost:3000", "http://localhost:3001"];

/**
 * Resolve the explicit CORS allowlist from `CORS_ALLOWED_ORIGINS` (comma
 * separated). Falls back to local dev origins outside production; in production
 * a missing allowlist throws so we never reflect arbitrary origins with
 * credentials enabled.
 */
export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.CORS_ALLOWED_ORIGINS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }
  if (env.NODE_ENV === "production") {
    throw new Error("Missing required config: CORS_ALLOWED_ORIGINS must be set in production");
  }
  return [...DEV_DEFAULT_ORIGINS];
}
