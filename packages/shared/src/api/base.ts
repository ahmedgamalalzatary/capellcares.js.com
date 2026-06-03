const DEFAULT_LOCAL_API_BASE = "http://localhost:4000";

function deriveBrowserApiBase(): string {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_API_BASE;
  }

  const { protocol, hostname, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//${hostname}:4000`;
  }

  if (hostname.startsWith("api.")) {
    return `${protocol}//${hostname}`;
  }

  if (hostname.includes(".")) {
    const parts = hostname.split(".");
    if (parts.length >= 2) {
      const rootDomain = hostname.startsWith("erp.") ? parts.slice(1).join(".") : hostname;
      return `${protocol}//api.${rootDomain}`;
    }
  }

  return DEFAULT_LOCAL_API_BASE;
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
