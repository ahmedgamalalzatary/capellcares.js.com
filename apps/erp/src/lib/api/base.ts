const DEFAULT_PUBLIC_API_BASE = "http://localhost:4000";

type ResolveApiBaseOptions = {
  isServer?: boolean;
};

export function resolveApiBase(
  env: NodeJS.ProcessEnv = process.env,
  options: ResolveApiBaseOptions = {}
): string {
  const internalBase = env.API_INTERNAL_URL?.trim();
  const isServer = options.isServer ?? typeof window === "undefined";
  if (isServer && internalBase) {
    return internalBase;
  }

  return env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_PUBLIC_API_BASE;
}
