import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import * as schema from "@capella/database/drizzle/schema";
import { checkoutSessions, orders, promoCodes } from "@capella/database/drizzle/schema";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { fixtureShippingService, selectedDestination } from "../helpers/checkout-shipping.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

// Phase 5 (spec sections 3.2, 5.2, 8.6): a code can waive the delivery fee; the store pays the carrier and records what it absorbed.
beforeEach(async () => {
  await resetApiTestDatabase();
  if ((schema as any).shippingCheckoutQuotes) await db.delete((schema as any).shippingCheckoutQuotes);
});

const CARRIER_FEE = 9729;

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "SHIPFREE", codeNormalized: "SHIPFREE", arName: "توصيل مجاني", enName: "Free delivery",
    status: "active", startsAt: new Date(Date.now() - 60_000), discountType: null, discountValue: null, freeShipping: true, eligibilityScope: "all",
    ...overrides }).$returningId();
  return row!.id;
}

async function checkout(paymentMethod: "cod" | "paymob" = "cod") {
  const ids = await getBaselineIds();
  return {
    fullName: "Free Delivery", phone: "01012345678", email: "free-delivery@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", paymentMethod, customerId: ids.customerId, promoCode: "shipfree",
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }], shippingAddress: selectedDestination
  };
}

test("a free-delivery-only code is refused while delivery is off, and applies once it is on", async () => {
  await code();
  const payload = await checkout();
  const off = await priceCheckout(payload, { shippingAvailable: false });
  assert.equal(off.promo?.dto.status, "rejected");
  assert.equal(off.promo?.dto.status === "rejected" && off.promo.dto.reason, "free_shipping_unavailable");
  const on = await priceCheckout(payload, { shippingAvailable: true });
  assert.equal(on.promo?.dto.status, "applied");
  assert.equal(on.promo?.dto.status === "applied" && on.promo.dto.freeShipping, true);
  assert.equal(on.promo?.application?.freeShipping, true);
});

test("a code with a discount and free delivery still gives the discount while delivery is off", async () => {
  await code({ discountType: "percentage", discountValue: "10.00" });
  const priced = await priceCheckout(await checkout(), { shippingAvailable: false });
  assert.equal(priced.promo?.dto.status, "applied");
  assert.equal(priced.promo?.dto.status === "applied" && priced.promo.dto.freeShipping, false);
  assert.ok(priced.promo?.dto.status === "applied" && priced.promo.dto.discount > 0);
});

test("the delivery quote with free delivery charges the customer nothing and keeps the carrier's fee", async () => {
  await code();
  const service = fixtureShippingService(CARRIER_FEE);
  for (const paymentMethod of ["cod", "paymob"] as const) {
    const payload = await checkout(paymentMethod);
    const priced = await priceCheckout(payload, { shippingAvailable: true });
    const quote = await service.quoteCheckout(payload, priced);
    const productsCents = Math.round(priced.totalAmount * 100);
    assert.equal(quote.shippingAmountCents, 0);
    assert.equal(quote.carrierShippingAmountCents, CARRIER_FEE);
    assert.equal(quote.amountCents, productsCents);
    // Bosta collects what the customer owes: the products only, or nothing when paid online.
    assert.equal(quote.codAmountCents, paymentMethod === "cod" ? productsCents : 0);
  }
});

test("without free delivery the quote's carrier fee is what the customer pays", async () => {
  const payload = { ...await checkout(), promoCode: undefined };
  const priced = await priceCheckout(payload, { shippingAvailable: true });
  const quote = await fixtureShippingService(CARRIER_FEE).quoteCheckout(payload, priced);
  assert.equal(quote.shippingAmountCents, CARRIER_FEE);
  assert.equal(quote.carrierShippingAmountCents, CARRIER_FEE);
});

test("a cash-on-delivery order with free delivery charges only the products and records the carrier fee the store absorbed", async () => {
  await code();
  const service = fixtureShippingService(CARRIER_FEE);
  const payload = await checkout();
  const quote = await service.quoteCheckout(payload, await priceCheckout(payload, { shippingAvailable: true }));
  const created = await createOrderFromCheckout({ ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: quote.amountCents },
    { idempotencyKey: crypto.randomUUID(), shippingService: service });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  assert.equal(order!.shippingAmountCents, 0);
  assert.equal(order!.promoShippingWaivedCents, CARRIER_FEE);
  assert.equal(Math.round(Number(order!.totalAmount) * 100), quote.productsTotalCents);
  assert.equal(order!.promoCodeText, "SHIPFREE");
});

test("an online payment with free delivery charges only the products and the order records the carrier fee absorbed", async () => {
  await code();
  const service = fixtureShippingService(CARRIER_FEE);
  const payload = await checkout("paymob");
  const quote = await service.quoteCheckout(payload, await priceCheckout(payload, { shippingAvailable: true }));
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  await initiatePaymobCheckout({ payload: { ...payload, shippingQuoteId: quote.quoteId }, idempotencyKey: crypto.randomUUID(), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result",
    shippingService: service, createIntention: async () => ({ intentionId: "pi_free", orderId: 9950, clientSecret: "free_secret", checkoutUrl: "https://checkout" }) });
  const [session] = await db.select().from(checkoutSessions);
  assert.equal(session!.amountCents, quote.productsTotalCents);
  assert.equal(session!.shippingAmountCents, 0);
  assert.equal(session!.promoShippingWaivedCents, CARRIER_FEE);

  const result = await processPaymobTransaction({ id: 79950, order: { id: 9950 }, amount_cents: session!.amountCents, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, is_standalone_payment: true, source_data: { type: "card" } });
  assert.equal(result.outcome, "succeeded");
  const [order] = await db.select().from(orders).where(eq(orders.id, result.orderId!));
  assert.equal(order!.shippingAmountCents, 0);
  assert.equal(order!.promoShippingWaivedCents, CARRIER_FEE);
});
