import { createHash } from "node:crypto";
import { BOSTA_RESPONSE_CONTRACT } from "./bosta.js";

export const deliveryQuoteSettings = { accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
  pickupCity: "Cairo", codUnit: "major", sizeMapping: { small: "Normal", medium: "FixtureMedium", large: "FixtureLarge" },
  responseContract: BOSTA_RESPONSE_CONTRACT };
// Controlled fixture following the documented bosta:v2 identity contract.
export function deliveryRateIdentity(codAmountCents: number, paymentMethod = "cod") {
  const pricingContractId = createHash("sha256").update(JSON.stringify([
    deliveryQuoteSettings.accountEvidence, "major", BOSTA_RESPONSE_CONTRACT,
    Object.entries(deliveryQuoteSettings.sizeMapping).sort(([a], [b]) => a.localeCompare(b))
  ])).digest("hex");
  return `bosta:v2:${createHash("sha256").update(JSON.stringify(["fixture", "https://stg-app.bosta.co/api/v2", pricingContractId,
    "Cairo", "Cairo", "district-nasr", "small", "Normal", "delivery", paymentMethod, codAmountCents])).digest("hex")}`;
}
export const deliverySettings = { accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
  pickupDefaultsVerified: true, defaultPickupCity: "Cairo", noInsuranceVerified: true, codUnit: "major",
  sizeMapping: { small: "SMALL", medium: "MEDIUM", large: "LARGE" },
  lookupContract: { verified: true, evidence: "controlled fixture only", resultsPath: ["data", "deliveries"], totalPath: ["data", "total"] } };
export const deliveryEnvironment = { BOSTA_ENABLED: "true", BOSTA_SHIPMENT_SENDING_ENABLED: "true", BOSTA_API_KEY: "fixture-secret-key",
  BOSTA_WEBHOOK_SECRET: "fixture-webhook-secret", BOSTA_BASE_URL: "https://stg-app.bosta.co/api/v2",
  BOSTA_DELIVERY_SETTINGS_JSON: JSON.stringify(deliverySettings), BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify(deliveryQuoteSettings) };
