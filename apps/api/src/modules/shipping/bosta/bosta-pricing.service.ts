import type { ShipmentSize } from "./bosta-quote.service.js";
import { BostaResponseValidationError } from "./bosta-client.js";
import { MAX_SHIPPING_RATE_CENTS } from "./bosta-rate-context.js";
export { MAX_SHIPPING_RATE_CENTS } from "./bosta-rate-context.js";

/**
 * Bosta account pricing backed by `GET /pricing/shipment/calculator`.
 * The documented request inputs are dropOffCity/pickupCity/cod/type/size with
 * provider sizes Normal / Light Bulky / Heavy Bulky. The response body is not
 * specified in the OpenAPI document, so the amount is parsed defensively and
 * any unparseable value is rejected rather than turned into a price.
 *
 * The Capella Small/Medium/Large -> provider pricing-size mapping is account
 * evidence (O06) and is NOT verified. It is injected; an unverified size has
 * no live quote path and is never guessed. Actual VAT/fee semantics remain
 * unverified until credentials are available; this adapter never fabricates
 * them.
 */

export type PricingResponseContract = {
  verified: boolean;
  evidence: string;
  amountPath: readonly string[];
  currency: "EGP";
  unit: "major" | "minor";
  vatIncluded: boolean;
  feesIncluded: boolean;
};

export function validatePricingResponseContract(contract: PricingResponseContract | undefined): asserts contract is PricingResponseContract {
  if (!contract || contract.verified !== true || contract.currency !== "EGP" ||
    !["major", "minor"].includes(contract.unit) || contract.vatIncluded !== true || contract.feesIncluded !== true ||
    typeof contract.evidence !== "string" || !contract.evidence.trim() ||
    !Array.isArray(contract.amountPath) || !contract.amountPath.length ||
    contract.amountPath.some(part => typeof part !== "string" || !part.trim())) {
    throw new Error("Bosta response/unit/VAT/fee contract is unverified (O06)");
  }
}

export type ShipmentRateRequest = {
  dropOffCity: string;
  pickupCity: string;
  cod: number | string;
  size: ShipmentSize;
};

/** Verified Capella size -> Bosta pricing-size mapping. Empty until O06 is confirmed. */
export type SizeMapping = Partial<Record<ShipmentSize, string>>;

export function buildShipmentCalculatorQuery(request: ShipmentRateRequest, sizeMapping: SizeMapping): URLSearchParams {
  const providerSize = sizeMapping[request.size];
  if (!providerSize) {
    throw new Error(`No verified Bosta pricing-size mapping for size "${request.size}" (O06 unverified)`);
  }
  const query = new URLSearchParams();
  query.set("dropOffCity", request.dropOffCity);
  query.set("pickupCity", request.pickupCity);
  query.set("cod", String(request.cod));
  query.set("type", "SEND");
  query.set("size", providerSize);
  return query;
}

/**
 * Parse an EGP-denominated price into integer cents. Accepts a non-negative
 * finite number or a plain decimal string with up to two decimal places, and
 * converts exactly. Rejects blank/non-decimal strings, negatives, non-finite
 * values and excess precision instead of rounding them into a fabricated
 * charge. The shared cents validator checks the converted minor units.
 */
function parseAmountCents(payload: unknown, contract: PricingResponseContract): number {
  let candidate = payload;
  for (const part of contract.amountPath) {
    candidate = candidate !== null && typeof candidate === "object" && Object.hasOwn(candidate, part)
      ? (candidate as Record<string, unknown>)[part] : undefined;
  }
  const value = typeof candidate === "string" ? candidate.trim() : typeof candidate === "number" ? String(candidate) : "";
  const pattern = contract.unit === "major" ? /^\d+(\.\d{1,2})?$/ : /^\d+$/;
  if (!pattern.test(value)) {
    throw new BostaResponseValidationError("Bosta pricing response did not contain a valid price");
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = contract.unit === "major"
    ? BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) : BigInt(whole);
  if (cents > BigInt(MAX_SHIPPING_RATE_CENTS)) {
    throw new BostaResponseValidationError("Bosta pricing response contained a price outside supported storage");
  }
  return Number(cents);
}

export class BostaPricingService {
  constructor(
    private readonly fetchShipmentPrice: (query: URLSearchParams) => Promise<unknown>,
    private readonly sizeMapping: SizeMapping,
    private readonly responseContract?: PricingResponseContract
  ) {}

  async fetchRate(request: ShipmentRateRequest): Promise<{ amountCents: number }> {
    const query = buildShipmentCalculatorQuery(request, this.sizeMapping);
    validatePricingResponseContract(this.responseContract);
    const payload = await this.fetchShipmentPrice(query);
    return { amountCents: parseAmountCents(payload, this.responseContract) };
  }
}
