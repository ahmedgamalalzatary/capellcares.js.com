type ResolveSecretOptions = {
  value: string | undefined;
  devFallback: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Resolve a runtime secret, failing closed in production.
 *
 * In production a missing/empty value throws so a misconfigured deployment
 * fails fast instead of silently signing/verifying with a public dev default.
 * Outside production the dev fallback is allowed for local convenience.
 */
export function resolveSecret(name: string, options: ResolveSecretOptions): string {
  const env = options.env ?? process.env;
  if (options.value && options.value.length > 0) {
    return options.value;
  }
  if (env.NODE_ENV === "production") {
    throw new Error(`Missing required secret: ${name} must be set in production`);
  }
  return options.devFallback;
}
