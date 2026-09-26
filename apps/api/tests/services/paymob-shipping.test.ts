import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orders, orderItems, productVariants, variantDiscounts, shippingWorkItems, orderReviewFlags } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { initiatePaymobCheckout, retryPaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { priceCheckout } from "../../src/modules/orders/orders.service.js";
import { submitCheckout } from "../../src/modules/checkout/checkout.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { fixtureShippingService, selectedDestination, shippingBuyer, withShippingEnvironment } from "../helpers/checkout-shipping.js";

beforeEach(resetApiTestDatabase);
const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
  hmacSecret: "hmac", enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
const urls = { config, notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result" };
const paid = { id: 8801, order: { id: 9801 }, amount_cents: 13229, currency: "EGP", integration_id: 123,
  success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
  is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };

async function setup() {
  const ids = await getBaselineIds();
  const shippingService = fixtureShippingService();
  const payload = { ...shippingBuyer, paymentMethod: "paymob" as const, shippingAddress: selectedDestination,
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const quote = await shippingService.quoteCheckout(payload, await priceCheckout(payload));
  return { ids, quote, input: { ...urls, payload: { ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 13229 },
    shippingService, idempotencyKey: crypto.randomUUID(),
    createIntention: async (request: any) => {
      assert.equal(request.amountCents, 13229, "provider must charge products plus shipping");
      return { intentionId: "pi_shipping", orderId: 9801, clientSecret: "shipping_secret", checkoutUrl: "https://checkout/shipping" };
    } } };
}

test("Paymob charges and persists the agreed shipping/address snapshot before any payment callback", async () => {
  const { input, quote } = await setup();
  const result = await initiatePaymobCheckout(input);
  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.publicId, result.checkoutId));
  assert.equal(session.amountCents, 13229);
  assert.equal(session.shippingAmountCents, 9729);
  assert.deepEqual(JSON.parse((session as any).shippingSnapshot), quote);
  assert.equal((await db.select().from(orders)).length, 0);
  assert.equal((await db.select().from(shippingWorkItems)).length, 0);
});

test("Paymob cannot reuse an idempotency key after the buyer changes address or customer ownership", async () => {
  const ids = await getBaselineIds();
  const input = { ...urls, payload: { ...shippingBuyer, paymentMethod: "paymob" as const,
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] }, idempotencyKey: crypto.randomUUID(),
    createIntention: async () => ({ intentionId: "pi_address", orderId: 9802, clientSecret: "address_secret", checkoutUrl: "https://checkout/address" }) };
  await initiatePaymobCheckout(input);
  for (const change of [{ addressLine: "Another street" }, { customerId: ids.customerId }]) {
    await assert.rejects(initiatePaymobCheckout({ ...input, payload: { ...input.payload, ...change } }), /different checkout/i);
  }
});

test("payment retry and callback retain the original quote and products after current prices change", async () => {
  const { input, ids, quote } = await setup();
  const first = await initiatePaymobCheckout(input);
  await processPaymobTransaction({ ...paid, success: false });
  await db.update(productVariants).set({ sellingPrice: "99.00" }).where(eq(productVariants.id, ids.firstVariantId));
  await retryPaymobCheckout({ ...urls, checkoutId: first.checkoutId, createIntention: async request => {
    assert.equal(request.amountCents, 13229);
    return { intentionId: "pi_shipping_retry", orderId: 9803, clientSecret: "retry_secret", checkoutUrl: "https://checkout/retry" };
  } });
  const transaction = { ...paid, id: 8803, order: { id: 9803 } };
  assert.equal((await processPaymobTransaction({ ...transaction, amount_cents: 3500 })).outcome, "rejected");
  const created = await processPaymobTransaction(transaction);
  const duplicate = await processPaymobTransaction(transaction);
  assert.equal(duplicate.orderId, created.orderId);
  const [order] = await db.select().from(orders).where(eq(orders.id, created.orderId!));
  const [line] = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  assert.equal(Number(line.unitPrice), 35);
  assert.equal(Number(order.totalAmount), 132.29);
  assert.equal(order.shippingAmountCents, 9729);
  assert.equal(order.shippingQuoteId, quote.quoteId);
  assert.deepEqual(JSON.parse((order as any).shippingSnapshot), quote);
  assert.equal((await db.select().from(orders)).length, 1);
  const jobs = await db.select().from(shippingWorkItems);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].orderId, created.orderId);
  assert.equal(jobs[0].status, "pending");
  await processPaymobTransaction({ ...transaction, is_refunded: true, refunded_amount_cents: 3500 });
  const [partiallyRefunded] = await db.select().from(orders).where(eq(orders.id, order.id));
  assert.equal(partiallyRefunded.providerPaymentStatus, "partially_refunded");
  await processPaymobTransaction({ ...transaction, is_refunded: true, refunded_amount_cents: 13229 });
  const [fullyRefunded] = await db.select().from(orders).where(eq(orders.id, order.id));
  assert.equal(fullyRefunded.refundedAmountCents, 13229);
  assert.equal(fullyRefunded.providerPaymentStatus, "refunded");
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "failed");
});

test("a full refund before success carries the original shipping-inclusive amount onto the eventual order", async () => {
  const { input, quote } = await setup();
  await initiatePaymobCheckout(input);
  assert.equal((await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 13229 })).outcome, "refund_pending_success");
  const result = await processPaymobTransaction(paid);
  const [order] = await db.select().from(orders).where(eq(orders.id, result.orderId!));
  assert.equal(order.providerPaymentStatus, "refunded");
  assert.equal(order.refundedAmountCents, 13229);
  assert.equal(order.shippingQuoteId, quote.quoteId);
  const jobs = await db.select().from(shippingWorkItems);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].status, "failed", "already refunded orders must never be dispatched");
});

test("a partial refund arriving before paid order creation blocks the delivery and raises a staff flag", async () => {
  const { input } = await setup();
  await initiatePaymobCheckout(input);
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 3500 });
  await processPaymobTransaction(paid);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "failed");
  assert.equal((await db.select().from(orderReviewFlags))[0]?.flagType, "refund_review");
});

test("free products with chargeable shipping still take the online-payment path", async () => {
  await withShippingEnvironment(async () => {
    const ids = await getBaselineIds();
    await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "100.00",
      startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 60000), status: "active" });
    const payload = { ...shippingBuyer, paymentMethod: "paymob" as const, shippingAddress: selectedDestination,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
    const { checkoutShippingServiceFromEnvironment } = await import("../../src/modules/shipping/checkout-shipping-runtime.js");
    const quote = await checkoutShippingServiceFromEnvironment()!.quoteCheckout(payload, await priceCheckout(payload));
    await assert.rejects(submitCheckout({ ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 9729 }, { idempotencyKey: crypto.randomUUID() }), /Paymob checkout is not configured/i);
    assert.equal((await db.select().from(orders)).length, 0);
  });
});

test("a zero-total prepaid quote creates a free COD order without losing its agreed snapshot", async () => {
  await withShippingEnvironment(async () => {
    const ids = await getBaselineIds();
    await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "100.00",
      startsAt: new Date(Date.now() - 60000), endsAt: new Date(Date.now() + 60000), status: "active" });
    const payload = { ...shippingBuyer, paymentMethod: "paymob" as const, shippingAddress: selectedDestination,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
    const { checkoutShippingServiceFromEnvironment } = await import("../../src/modules/shipping/checkout-shipping-runtime.js");
    const quote = await checkoutShippingServiceFromEnvironment()!.quoteCheckout(payload, await priceCheckout(payload));
    const result = await submitCheckout({ ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 0 }, { idempotencyKey: crypto.randomUUID() });
    assert.equal(result.kind, "cod_order");
    const [order] = await db.select().from(orders);
    assert.equal(order.paymentStatus, "accepted");
    assert.equal(order.paymentMethod, "cod");
    assert.equal(order.shippingQuoteId, quote.quoteId);
  }, true, "0.00");
});
