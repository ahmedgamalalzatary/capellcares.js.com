import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { shippingCheckoutQuotes } from "@capella/database/drizzle/schema";
import { checkoutShippingQuoteSchema, shippingAddressSchema,
  type CheckoutShippingQuote, type ShippingDestination, type CheckoutRequestDto } from "@capella/shared";
import type { BostaQuoteInput } from "./bosta/bosta-quote-composition.js";
import type { ShippingQuote } from "./bosta/bosta-quote.service.js";
import { ShippingUnsupportedDestinationError } from "./bosta/bosta-quote.service.js";

export class CheckoutShippingError extends Error {
  constructor(public readonly code: "SHIPPING_QUOTE_CHANGED" | "SHIPPING_UNSUPPORTED" | "SHIPPING_UNAVAILABLE",
    public readonly status: number = code === "SHIPPING_QUOTE_CHANGED" ? 409 : code === "SHIPPING_UNSUPPORTED" ? 400 : 503) {
    super(code === "SHIPPING_QUOTE_CHANGED" ? "Shipping quote changed; refresh and review the total before paying"
      : code === "SHIPPING_UNSUPPORTED" ? "The selected destination is unavailable for delivery"
        : "Shipping is temporarily unavailable; try again");
  }
}

type QuoteRequest = Pick<CheckoutRequestDto, "items" | "paymentMethod" | "shippingAddress" | "customerId">;
type PricedCheckout = { items: unknown[]; totalAmount: number };
export type CheckoutShippingProvider = {
  codPricingPolicy: "collection_total";
  listDestinations(): Promise<ShippingDestination[]>;
  quote(input: BostaQuoteInput): Promise<ShippingQuote>;
};

function fingerprint(payload: QuoteRequest, priced: PricedCheckout): string {
  return createHash("sha256").update(JSON.stringify([
    payload.customerId ?? null, payload.items, payload.paymentMethod,
    shippingAddressSchema.parse(payload.shippingAddress), priced.items, Math.round(priced.totalAmount * 100)
  ])).digest("hex");
}

export function createCheckoutShippingService(provider: CheckoutShippingProvider) {
  async function calculate(payload: QuoteRequest, priced: PricedCheckout, initialCod?: number): Promise<CheckoutShippingQuote> {
    if (provider.codPricingPolicy !== "collection_total") throw new CheckoutShippingError("SHIPPING_UNAVAILABLE");
    const selected = shippingAddressSchema.safeParse(payload.shippingAddress);
    if (!selected.success) throw new CheckoutShippingError("SHIPPING_UNSUPPORTED");
    const addresses = await provider.listDestinations().catch(() => { throw new CheckoutShippingError("SHIPPING_UNAVAILABLE"); });
    const address = addresses.find(row => row.cityId === selected.data.cityId && row.zoneId === selected.data.zoneId && row.districtId === selected.data.districtId);
    if (!address) throw new CheckoutShippingError("SHIPPING_UNSUPPORTED");
    const productsTotalCents = Math.round(priced.totalAmount * 100);
    let codAmountCents = payload.paymentMethod === "cod" ? initialCod ?? productsTotalCents : 0;
    const visited = new Set<number>();
    for (let iteration = 0; iteration < 8; iteration++) {
      if (visited.has(codAmountCents)) throw new CheckoutShippingError("SHIPPING_UNAVAILABLE");
      visited.add(codAmountCents);
      const rate = await provider.quote({ cityId: address.cityId, districtId: address.districtId,
        productsTotalCents, paymentMethod: payload.paymentMethod === "cod" ? "cod" : "prepaid", codAmountCents }).catch(error => {
        throw new CheckoutShippingError(error instanceof ShippingUnsupportedDestinationError ? "SHIPPING_UNSUPPORTED" : "SHIPPING_UNAVAILABLE");
      });
      const quote = checkoutShippingQuoteSchema.parse({ ...rate,
        productsTotalCents, amountCents: productsTotalCents + rate.shippingAmountCents,
        codAmountCents, paymentMethod: payload.paymentMethod, address });
      if (payload.paymentMethod === "paymob" || quote.amountCents === codAmountCents) return quote;
      codAmountCents = quote.amountCents;
    }
    throw new CheckoutShippingError("SHIPPING_UNAVAILABLE");
  }
  return {
    listDestinations: () => provider.listDestinations(),
    async quoteCheckout(payload: QuoteRequest, priced: PricedCheckout) {
      const quote = await calculate(payload, priced);
      const checkoutFingerprint = fingerprint(payload, priced);
      const { quoteId: _providerQuoteId, quotedAt: _providerQuotedAt, ...agreement } = quote;
      // Stable while the agreed cart/destination/payment/rate remains identical.
      // Reloading checkout must not allocate another payment idempotency key.
      quote.quoteId = `quote_${createHash("sha256").update(JSON.stringify([checkoutFingerprint, agreement])).digest("hex").slice(0, 58)}`;
      await db.insert(shippingCheckoutQuotes).values({ quoteId: quote.quoteId,
        checkoutFingerprint, snapshot: JSON.stringify(quote) }).onDuplicateKeyUpdate({ set: { quoteId: quote.quoteId } });
      const [stored] = await db.select().from(shippingCheckoutQuotes).where(eq(shippingCheckoutQuotes.quoteId, quote.quoteId)).limit(1);
      return checkoutShippingQuoteSchema.parse(JSON.parse(stored.snapshot));
    },
    async resolve(payload: CheckoutRequestDto, priced: PricedCheckout) {
      if (!payload.shippingQuoteId || !payload.shippingAddress) throw new CheckoutShippingError("SHIPPING_QUOTE_CHANGED");
      const [stored] = await db.select().from(shippingCheckoutQuotes).where(eq(shippingCheckoutQuotes.quoteId, payload.shippingQuoteId)).limit(1);
      if (!stored || stored.checkoutFingerprint !== fingerprint(payload, priced)) throw new CheckoutShippingError("SHIPPING_QUOTE_CHANGED");
      const agreed = checkoutShippingQuoteSchema.parse(JSON.parse(stored.snapshot));
      const current = await calculate(payload, priced, agreed.codAmountCents);
      if (current.shippingAmountCents !== agreed.shippingAmountCents || current.size !== agreed.size ||
        current.rateIdentity !== agreed.rateIdentity || JSON.stringify(current.address) !== JSON.stringify(agreed.address)) {
        throw new CheckoutShippingError("SHIPPING_QUOTE_CHANGED");
      }
      return agreed;
    }
  };
}
export type CheckoutShippingService = ReturnType<typeof createCheckoutShippingService>;
