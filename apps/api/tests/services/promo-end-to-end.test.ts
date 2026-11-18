import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import * as schema from "@capella/database/drizzle/schema";
import { checkoutSessions, customers, orderItems, orders, productVariants, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { PromoRejectedError } from "../../src/modules/promos/promo-checkout.js";
import { getPromoCodeReportRepo } from "../../src/modules/promos/promo-report.repository.js";
import { fixtureShippingService, selectedDestination } from "../helpers/checkout-shipping.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

// Phase 8 (spec section 12): the whole feature in one run, and a limited code under concurrent use.
beforeEach(async () => {
  await resetApiTestDatabase();
  if ((schema as any).shippingCheckoutQuotes) await db.delete((schema as any).shippingCheckoutQuotes);
});

const CARRIER_FEE = 6500;
const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
  apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
const urls = { notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result" };
const stockOf = async (variantId: number) => (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stockQty;
const paid = (providerOrderId: number, amountCents: number, extra: object = {}) => ({ id: providerOrderId + 70_000, order: { id: providerOrderId },
  amount_cents: amountCents, currency: "EGP", integration_id: 123, success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
  is_refunded: false, is_voided: false, has_parent_transaction: false, is_standalone_payment: true, source_data: { type: "card" }, ...extra });

test("one code with a discount, free delivery and a gift works end to end: COD denied and expired, Paymob paid and partly refunded", async () => {
  const ids = await getBaselineIds();
  const [{ id: codeId }] = await db.insert(promoCodes).values({ code: "ALLIN", codeNormalized: "ALLIN", arName: "الكل", enName: "All in", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "20.00", freeShipping: true, eligibilityScope: "all",
    giftItemType: "product_variant", giftItemId: ids.secondVariantId, giftQty: 1, totalUsageLimit: 10 }).$returningId();
  const service = fixtureShippingService(CARRIER_FEE);
  const startFirst = await stockOf(ids.firstVariantId);
  const startGift = await stockOf(ids.secondVariantId);
  const buyer = (email: string, paymentMethod: "cod" | "paymob") => ({ fullName: "All In", phone: "01012345678", email, governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod, customerId: ids.customerId, promoCode: "allin",
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 2 }], shippingAddress: selectedDestination });
  const quoted = async (payload: ReturnType<typeof buyer>) => {
    const quote = await service.quoteCheckout(payload, await priceCheckout(payload, { shippingAvailable: true }));
    return { ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: quote.amountCents, quote };
  };

  // Every benefit at once: 20% off, delivery 0 with the carrier fee kept, and the gift line.
  const cod = await quoted(buyer("cod-1@capella.test", "cod"));
  const plain = await priceCheckout({ ...cod, promoCode: undefined });
  assert.equal(cod.quote.shippingAmountCents, 0);
  assert.equal(cod.quote.carrierShippingAmountCents, CARRIER_FEE);
  assert.equal(cod.quote.amountCents, Math.round(plain.totalAmount * 80));
  const denied = await createOrderFromCheckout(cod, { idempotencyKey: crypto.randomUUID(), shippingService: service });
  const [deniedOrder] = await db.select().from(orders).where(eq(orders.id, denied.id));
  assert.equal(deniedOrder!.promoShippingWaivedCents, CARRIER_FEE);
  assert.equal((await db.select().from(orderItems).where(and(eq(orderItems.orderId, denied.id), eq(orderItems.isPromoGift, true)))).length, 1);
  assert.equal(await stockOf(ids.firstVariantId), startFirst - 2);
  assert.equal(await stockOf(ids.secondVariantId), startGift - 1);

  // Staff deny: stock (gift included) and the use come back.
  await updateOrderPaymentStatusRepo(denied.id, "denied");
  assert.equal(await stockOf(ids.firstVariantId), startFirst);
  assert.equal(await stockOf(ids.secondVariantId), startGift);

  // Untouched for 96 hours: expired the same way.
  const second = await quoted(buyer("cod-2@capella.test", "cod"));
  const expired = await createOrderFromCheckout(second, { idempotencyKey: crypto.randomUUID(), shippingService: service });
  await expirePendingCodOrders(new Date(Date.now() + 200 * 60 * 60 * 1000));
  assert.equal(await stockOf(ids.secondVariantId), startGift);

  // Paymob: paid at the discounted amount, then Paymob refunds part of it after the order exists.
  const online = await quoted(buyer("online@capella.test", "paymob"));
  await initiatePaymobCheckout({ payload: online, idempotencyKey: crypto.randomUUID(), config, ...urls, shippingService: service,
    createIntention: async () => ({ intentionId: "pi_allin", orderId: 9970, clientSecret: "allin_secret", checkoutUrl: "https://checkout" }) });
  const [session] = await db.select().from(checkoutSessions);
  assert.equal(session!.amountCents, online.quote.amountCents);
  const result = await processPaymobTransaction(paid(9970, session!.amountCents));
  assert.equal(result.outcome, "succeeded");
  const refund = await processPaymobTransaction(paid(9970, session!.amountCents, { is_refunded: true }),
    { verified: { is_refunded: true, refunded_amount_cents: 1000, environment: "test" } });
  assert.equal(refund.outcome, "refunded");

  const uses = await db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, codeId));
  assert.deepEqual(uses.map((use) => [use.orderId, use.state, use.releaseReason]).sort(),
    [[denied.id, "released", "denied"], [expired.id, "released", "expired"], [result.orderId, "used", null]].sort());
  const live = uses.find((use) => use.state === "used")!;
  assert.equal(live.shippingWaivedCents, CARRIER_FEE);
  assert.ok(live.giftValueCents > 0);

  // The report agrees with the one order still using the code.
  const report = (await getPromoCodeReportRepo(codeId))!;
  const [paidOrder] = await db.select().from(orders).where(eq(orders.id, result.orderId!));
  assert.deepEqual(report.uses, { used: 1, reserved: 0, released: 2, overLimit: 0, remaining: 9 });
  assert.equal(report.money.revenueCents, Math.round(Number(paidOrder!.totalAmount) * 100) - 1000);
  assert.equal(report.money.shippingAbsorbedCents, CARRIER_FEE);
  assert.equal(report.money.discountCents, paidOrder!.promoDiscountCents);
  assert.deepEqual(report.health.cancelled, { count: 2, total: 3 });
  assert.deepEqual(report.health.refunded, { count: 1, total: 3 });
});

test("a code limited to 5 uses gives exactly 5 under 25 checkouts at the same moment", async () => {
  const ids = await getBaselineIds();
  await db.update(productVariants).set({ stockQty: 100 }).where(eq(productVariants.id, ids.firstVariantId));
  await db.insert(promoCodes).values({ code: "FIVE", codeNormalized: "FIVE", arName: "خمسة", enName: "Five", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", totalUsageLimit: 5 });
  const shoppers = await Promise.all(Array.from({ length: 25 }, async (_, index) => {
    const [row] = await db.insert(customers).values({ name: `Shopper ${index}`, email: `shopper${index}@capella.test`, passwordHash: "unused" }).$returningId();
    return row!.id;
  }));
  const results = await Promise.allSettled(shoppers.map((customerId, index) => createOrderFromCheckout({
    fullName: `Shopper ${index}`, phone: `0101000${String(index).padStart(4, "0")}`, email: `shopper${index}@capella.test`, governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod", customerId, promoCode: "five",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] }, { idempotencyKey: crypto.randomUUID() })));

  const placed = results.filter((result) => result.status === "fulfilled");
  const refused = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.equal(placed.length, 5);
  assert.ok(refused.every((result) => result.reason instanceof PromoRejectedError && result.reason.rejection.reason === "usage_limit"),
    refused.map((result) => String(result.reason)).join("; "));
  assert.equal((await db.select().from(promoRedemptions).where(eq(promoRedemptions.state, "used"))).length, 5);
  assert.equal(await stockOf(ids.firstVariantId), 95);
});
