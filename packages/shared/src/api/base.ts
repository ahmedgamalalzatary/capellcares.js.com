const DEFAULT_LOCAL_API_BASE = "http://localhost:4000";
const DEFAULT_PRODUCTION_API_BASE = "https://api.capellacares.com";

function deriveBrowserApiBase(): string {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_API_BASE;
  }

  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:4000`;
  }

  return DEFAULT_PRODUCTION_API_BASE;
}

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

  return env.NEXT_PUBLIC_API_URL?.trim() || deriveBrowserApiBase();
}
