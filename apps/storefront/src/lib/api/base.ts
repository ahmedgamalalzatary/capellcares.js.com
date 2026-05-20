const DEFAULT_PUBLIC_API_BASE = "http://localhost:4000";

export function resolveApiBase(env: NodeJS.ProcessEnv = process.env): string {
  const internalBase = env.API_INTERNAL_URL?.trim();
  if (typeof window === "undefined" && internalBase) {
    return internalBase;
  }

  return env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_PUBLIC_API_BASE;
}
