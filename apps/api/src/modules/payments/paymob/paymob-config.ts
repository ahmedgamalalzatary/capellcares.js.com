export type PaymobMethod = "card" | "wallet";

export interface PaymobConfig {
  mode: "test" | "live";
  baseUrl: "https://accept.paymob.com";
  secretKey: string | null;
  publicKey: string | null;
  hmacSecret: string | null;
  enabledMethods: Array<{ method: PaymobMethod; integrationId: number }>;
  canInitiatePayments: boolean;
  intentionExpirationSeconds: 1800;
}

function confirmedIntegration(
  env: NodeJS.ProcessEnv,
  method: PaymobMethod,
  idName: string,
  confirmationName: string
): { method: PaymobMethod; integrationId: number } | null {
  if (env[confirmationName] !== "true") return null;
  const integrationId = Number(env[idName]);
  if (!Number.isSafeInteger(integrationId) || integrationId <= 0) {
    throw new Error(`${idName} must be a positive integer when ${confirmationName}=true`);
  }
  return { method, integrationId };
}

export function resolvePaymobConfig(env: NodeJS.ProcessEnv = process.env): PaymobConfig {
  const mode = env.PAYMOB_MODE === "live" ? "live" : "test";
  const enabledMethods = [
    confirmedIntegration(env, "card", "PAYMOB_CARD_INTEGRATION_ID", "PAYMOB_CARD_INTEGRATION_CONFIRMED"),
    confirmedIntegration(env, "wallet", "PAYMOB_WALLET_INTEGRATION_ID", "PAYMOB_WALLET_INTEGRATION_CONFIRMED")
  ].filter((value): value is { method: PaymobMethod; integrationId: number } => value !== null);

  const secretKey = env.PAYMOB_SECRET_KEY?.trim() || null;
  const publicKey = env.PAYMOB_PUBLIC_KEY?.trim() || null;
  const hmacSecret = env.PAYMOB_HMAC_SECRET?.trim() || null;
  if (enabledMethods.length > 0 && (!secretKey || !publicKey || !hmacSecret)) {
    throw new Error("Confirmed Paymob integrations require Secret Key, Public Key, and HMAC Secret");
  }

  return {
    mode,
    baseUrl: "https://accept.paymob.com",
    secretKey,
    publicKey,
    hmacSecret,
    enabledMethods,
    canInitiatePayments: enabledMethods.length > 0,
    intentionExpirationSeconds: 1800
  };
}
