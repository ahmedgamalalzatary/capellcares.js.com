import { inspect } from "node:util";

export type BostaConfig = {
  enabled: boolean;
  canCallProvider: boolean;
  apiKey: string | null;
  baseUrl: string | null;
  webhookSecret: string | null;
  timeoutMs: number;
  toJSON?: () => Record<string, unknown>;
  [inspect.custom]?: () => Record<string, unknown>;
};

const DEFAULT_TIMEOUT_MS = 10_000;
// Node setTimeout clamps above the signed 32-bit range; keep timeouts sane.
const MAX_TIMEOUT_MS = 2_147_483_647;

function requireEnabled(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Bosta integration is enabled but ${key} is not configured`);
  }
  return value;
}

function redactedView(config: BostaConfig): Record<string, unknown> {
  return {
    enabled: config.enabled,
    canCallProvider: config.canCallProvider,
    apiKey: config.apiKey == null ? null : "[redacted]",
    baseUrl: config.baseUrl,
    webhookSecret: config.webhookSecret == null ? null : "[redacted]",
    timeoutMs: config.timeoutMs
  };
}

function parseTimeout(env: Record<string, string | undefined>): number {
  const raw = env.BOSTA_TIMEOUT_MS?.trim();
  if (raw == null || raw === "") {
    return DEFAULT_TIMEOUT_MS;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0 || value > MAX_TIMEOUT_MS) {
    throw new Error("BOSTA_TIMEOUT_MS must be a positive integer within Node's timer range");
  }
  return value;
}

function parseBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("BOSTA_BASE_URL must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("BOSTA_BASE_URL must use HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("BOSTA_BASE_URL must not contain credentials, a query string or a fragment");
  }
  // Normalize: strip any trailing slash so endpoint composition is predictable.
  return url.toString().replace(/\/+$/, "");
}

/**
 * Define the credential properties as non-enumerable so spread /
 * Object.entries / JSON enumeration never copies the plaintext secrets, while
 * the client can still read them directly. JSON.stringify and node:util
 * inspect are given explicit redacted views.
 */
function defineSecrets(config: BostaConfig, apiKey: string | null, webhookSecret: string | null): void {
  Object.defineProperty(config, "apiKey", {
    value: apiKey,
    enumerable: false,
    writable: false,
    configurable: true
  });
  Object.defineProperty(config, "webhookSecret", {
    value: webhookSecret,
    enumerable: false,
    writable: false,
    configurable: true
  });
}

export function loadBostaConfig(env: Record<string, string | undefined>): BostaConfig {
  const rawEnabled = env.BOSTA_ENABLED?.trim().toLowerCase();
  if (rawEnabled != null && rawEnabled !== "" && rawEnabled !== "true" && rawEnabled !== "false") {
    throw new Error(`BOSTA_ENABLED must be "true" or "false", got an unrecognized value`);
  }
  const enabled = rawEnabled === "true";
  const timeoutMs = parseTimeout(env);

  if (!enabled) {
    const config = {
      enabled: false,
      canCallProvider: false,
      baseUrl: null,
      timeoutMs
    } as BostaConfig;
    defineSecrets(config, null, null);
    config.toJSON = () => redactedView(config);
    config[inspect.custom] = () => redactedView(config);
    return config;
  }

  const apiKey = requireEnabled(env, "BOSTA_API_KEY");
  const baseUrl = parseBaseUrl(requireEnabled(env, "BOSTA_BASE_URL"));
  const webhookSecret = requireEnabled(env, "BOSTA_WEBHOOK_SECRET");

  const config = {
    enabled: true,
    canCallProvider: true,
    baseUrl,
    timeoutMs
  } as BostaConfig;
  defineSecrets(config, apiKey, webhookSecret);
  config.toJSON = () => redactedView(config);
  config[inspect.custom] = () => redactedView(config);
  return config;
}