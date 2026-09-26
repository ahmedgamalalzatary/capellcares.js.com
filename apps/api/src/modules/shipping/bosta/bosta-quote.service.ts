import { randomUUID, createHash } from "node:crypto";
import { shippingMoneyCentsSchema } from "@capella/shared";
import { BostaProviderError } from "./bosta-client.js";
import { buildRateIdentity, shippingRateAmountSchema, validateShippingRateContext,
  type ShippingRateContext } from "./bosta-rate-context.js";
export { buildRateIdentity } from "./bosta-rate-context.js";

export type ShipmentSize = "small" | "medium" | "large";

const MEDIUM_THRESHOLD_CENTS = 700_000; // EGP 7,000.00 — over this is Medium
const LARGE_THRESHOLD_CENTS = 2_000_000; // EGP 20,000.00 — over this is Large

/**
 * D06: estimate size from the full products total after discounts, excluding
 * shipping. Boundaries are inclusive of the lower band: exactly 7,000 is Small,
 * exactly 20,000 is Medium.
 */
export function estimateShipmentSize(productsTotalCents: number): ShipmentSize {
  if (productsTotalCents > LARGE_THRESHOLD_CENTS) return "large";
  if (productsTotalCents > MEDIUM_THRESHOLD_CENTS) return "medium";
  return "small";
}

export class ShippingUnsupportedDestinationError extends Error {
  constructor(districtId: string) {
    super(`Destination is not supported for delivery: ${districtId}`);
  }
}

export class ShippingQuoteUnavailableError extends Error {
  constructor() {
    super("No valid shipping rate is available for the chosen destination and size");
  }
}

export type ShippingQuote = {
  quoteId: string;
  shippingAmountCents: number;
  size: ShipmentSize;
  rateIdentity: string;
  source: "live" | "saved";
  quotedAt: string;
};

export type ShippingQuoteRequest = {
  districtId: string;
  productsTotalCents: number;
  rateContext: Omit<ShippingRateContext, "destinationId" | "size">;
};

export type ShippingQuoteDeps = {
  isDestinationSupported: (districtId: string) => Promise<boolean>;
  fetchLiveRate: (input: ShippingRateContext) => Promise<{ amountCents: number; rateIdentity: string } | null>;
  loadSavedRate: (input: ShippingRateContext) => Promise<{ amountCents: number; rateIdentity: string } | null>;
  saveRate: (rate: ShippingRateContext & { amountCents: number }) => Promise<void>;
};

function isValidAmount(amountCents: number): boolean {
  return shippingRateAmountSchema.safeParse(amountCents).success;
}

/**
 * Server-authoritative quote. The rate identity binds the complete account,
 * environment, pricing and collection context, so unrelated rates cannot be
 * reused. Live rates are validated and persisted as the new fallback;
 * saved rates have no age-based expiry (D16). No valid rate blocks order
 * placement. A thrown live outage falls back to a valid saved rate; a
 * definitive rejection does not.
 */
export async function resolveShippingQuote(
  request: ShippingQuoteRequest,
  deps: ShippingQuoteDeps
): Promise<ShippingQuote> {
  // Validate the request's money/address context before any dependency runs.
  if (!shippingMoneyCentsSchema.safeParse(request.productsTotalCents).success) {
    throw new Error("Invalid products total for shipping quote");
  }
  if (typeof request.districtId !== "string" || request.districtId.trim() === "") {
    throw new Error("Invalid destination for shipping quote");
  }

  const size = estimateShipmentSize(request.productsTotalCents);
  const context = validateShippingRateContext({ ...request.rateContext, destinationId: request.districtId, size });
  const expectedIdentity = buildRateIdentity(context);

  if (!(await deps.isDestinationSupported(request.districtId))) {
    throw new ShippingUnsupportedDestinationError(request.districtId);
  }

  let live: { amountCents: number; rateIdentity: string } | null = null;
  try {
    live = await deps.fetchLiveRate(context);
  } catch (error) {
    // Only classified recoverable provider outages fall back to a saved rate
    // (D16). A definitive rejection is final; malformed-data or programming
    // errors are surfaced, never silently turned into a saved quote.
    if (error instanceof BostaProviderError) {
      if (error.kind === "definitive") {
        throw new ShippingQuoteUnavailableError();
      }
      live = null; // throttled / transient / ambiguous outage -> try saved rate
    } else {
      throw error;
    }
  }

  if (live) {
    // Validate the live rate before trusting or persisting it: the amount must
    // be valid integer cents and the identity must match this exact request.
    if (isValidAmount(live.amountCents) && live.rateIdentity === expectedIdentity) {
      await deps.saveRate({ ...context, amountCents: live.amountCents });
      return {
        quoteId: `quote_${randomUUID()}`,
        shippingAmountCents: live.amountCents,
        size,
        rateIdentity: live.rateIdentity,
        source: "live",
        quotedAt: new Date().toISOString()
      };
    }
    // Invalid or mismatched live data is never saved or returned as a price.
    throw new ShippingQuoteUnavailableError();
  }

  const saved = await deps.loadSavedRate(context);
  // A saved rate is only valid for the exact destination + size it was fetched
  // for, and only with a valid amount. Anything else is never reused.
  if (saved && saved.rateIdentity === expectedIdentity && isValidAmount(saved.amountCents)) {
    return {
      quoteId: `quote_${createHash("sha256").update(`${saved.rateIdentity}:${saved.amountCents}`).digest("hex").slice(0, 32)}`,
      shippingAmountCents: saved.amountCents,
      size,
      rateIdentity: saved.rateIdentity,
      source: "saved",
      quotedAt: new Date().toISOString()
    };
  }

  throw new ShippingQuoteUnavailableError();
}
