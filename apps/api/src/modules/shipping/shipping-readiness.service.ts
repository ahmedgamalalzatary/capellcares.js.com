import { loadBostaConfig } from "./bosta/bosta-config.js";
import { checkoutShippingServiceFromEnvironment } from "./checkout-shipping-runtime.js";
import { bostaDeliveryProviderFromEnvironment } from "./bosta/bosta-delivery.service.js";
import { resolveBostaSyncRuntime } from "./bosta/bosta-sync.service.js";
import { resolveBostaCancellationRuntime } from "./bosta/bosta-cancellation.service.js";
import { resolveBostaEditRuntime } from "./bosta/bosta-edit.service.js";

/** Validates configured contracts only; it does not verify merchant evidence or call the provider/database. */
export function checkShippingConfiguration(env: Record<string, string | undefined>) {
  const errors: string[] = [];
  const noHttp: typeof fetch = async () => { throw new Error("Configuration checks prohibit HTTP requests"); };
  function validate<T>(code: string, build: () => T): T | null {
    try { return build(); }
    catch { errors.push(code); return null; }
  }
  for (const name of ["BOSTA_ENABLED", "BOSTA_SHIPMENT_SENDING_ENABLED", "BOSTA_SYNC_ENABLED", "BOSTA_CANCELLATION_ENABLED", "BOSTA_EDITS_ENABLED"]) {
    const value = env[name]?.trim().toLowerCase();
    if (value && value !== "true" && value !== "false") errors.push(`${name}_INVALID`);
  }
  const config = validate("PROVIDER_CONFIGURATION_INVALID", () => loadBostaConfig(env));
  const quote = validate("QUOTE_CONFIGURATION_INVALID", () => checkoutShippingServiceFromEnvironment(env, noHttp));
  const delivery = validate("DELIVERY_CONFIGURATION_INVALID", () => bostaDeliveryProviderFromEnvironment(env, noHttp, { recoveryOnly: true }));
  const sync = validate("SYNC_CONFIGURATION_INVALID", () => resolveBostaSyncRuntime(env, noHttp));
  const cancellation = validate("CANCELLATION_CONFIGURATION_INVALID", () => resolveBostaCancellationRuntime(env, noHttp));
  const edits = validate("EDIT_CONFIGURATION_INVALID", () => resolveBostaEditRuntime(env, noHttp));
  const contracts: { accountId: string; pickupCity?: string; defaultPickupCity?: string }[] = [];
  if (quote) contracts.push(JSON.parse(env.BOSTA_QUOTE_SETTINGS_JSON!));
  if (delivery) contracts.push(JSON.parse(env.BOSTA_DELIVERY_SETTINGS_JSON!));
  if (sync) contracts.push({ accountId: sync.accountId });
  if (new Set(contracts.map(contract => contract.accountId)).size > 1) errors.push("SHIPPING_ACCOUNT_MISMATCH");
  if (quote && delivery && contracts[0].pickupCity !== contracts[1].defaultPickupCity) errors.push("PICKUP_CITY_MISMATCH");
  if (delivery?.canCreate && !sync) errors.push("SENDING_REQUIRES_SYNCHRONIZATION");
  return { valid: errors.length === 0, providerCalls: config?.canCallProvider ?? false,
    quoting: quote !== null, sending: delivery?.canCreate ?? false, deliveryRecovery: delivery !== null,
    synchronization: sync !== null, cancellation: cancellation !== null, edits: edits !== null, errors };
}
