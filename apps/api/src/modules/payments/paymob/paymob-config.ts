export type PaymobMethod = "card" | "wallet";

export interface PaymobConfig {
  mode: "test" | "live";
  baseUrl: "https://accept.paymob.com";
  secretKey: string | null;
  publicKey: string | null;
  hmacSecret: string | null;
  /** Separate merchant credential that authenticates the transaction inquiry, distinct from `secretKey` and deliberately nullable so its absence cannot silently fall back to the wrong credential — callers must handle "no inquiry possible" explicitly. */
  apiKey: string | null;
  enabledMethods: Array<{ method: PaymobMethod; integrationId: number }>;
  canInitiatePayments: boolean;
  intentionExpirationSeconds: 1800;
}

/** Reads one of the two documented booleans; a typo must fail loudly, because this flag is the only thing between a half-configured integration and silently disabling a payment method — an unrecognized value is an error rather than a "no". */
function confirmedFlag(env: NodeJS.ProcessEnv, name: string): boolean {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === "") return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be "true" or "false", got an unrecognized value`);
}

function confirmedIntegration(
  env: NodeJS.ProcessEnv,
  method: PaymobMethod,
  idName: string,
  confirmationName: string
): { method: PaymobMethod; integrationId: number } | null {
  if (!confirmedFlag(env, confirmationName)) return null;
  const integrationId = Number(env[idName]);
  if (!Number.isSafeInteger(integrationId) || integrationId <= 0) {
    throw new Error(`${idName} must be a positive integer when ${confirmationName}=true`);
  }
  return { method, integrationId };
}

export function resolvePaymobConfig(env: NodeJS.ProcessEnv = process.env): PaymobConfig {
  // Only the two documented environments exist; anything else used to fall through to "test", which is indistinguishable from a deliberately sandboxed deployment — a live deployment with a typo here would aim real payments at the sandbox.
  const rawMode = env.PAYMOB_MODE?.trim();
  if (rawMode !== undefined && rawMode !== "" && rawMode !== "live" && rawMode !== "test") {
    throw new Error(`PAYMOB_MODE must be "test" or "live", got an unrecognized value`);
  }
  const mode = rawMode === "live" ? "live" : "test";
  const enabledMethods = [
    confirmedIntegration(env, "card", "PAYMOB_CARD_INTEGRATION_ID", "PAYMOB_CARD_INTEGRATION_CONFIRMED"),
    confirmedIntegration(env, "wallet", "PAYMOB_WALLET_INTEGRATION_ID", "PAYMOB_WALLET_INTEGRATION_CONFIRMED")
  ].filter((value): value is { method: PaymobMethod; integrationId: number } => value !== null);

  const secretKey = env.PAYMOB_SECRET_KEY?.trim() || null;
  const publicKey = env.PAYMOB_PUBLIC_KEY?.trim() || null;
  const hmacSecret = env.PAYMOB_HMAC_SECRET?.trim() || null;
  // The API Key is a SEPARATE credential from the Secret Key: it mints the bearer token used by the transaction inquiry. It is not required to take payments, so a missing value must not block checkout — it only disables authenticated refund verification, which is exactly the condition the evidence guards must fail closed on.
  const apiKey = env.PAYMOB_API_KEY?.trim() || null;
  if (enabledMethods.length > 0 && (!secretKey || !publicKey || !hmacSecret)) {
    throw new Error("Confirmed Paymob integrations require Secret Key, Public Key, and HMAC Secret");
  }

  return {
    mode,
    baseUrl: "https://accept.paymob.com",
    secretKey,
    publicKey,
    hmacSecret,
    apiKey,
    enabledMethods,
    canInitiatePayments: enabledMethods.length > 0,
    intentionExpirationSeconds: 1800
  };
}
