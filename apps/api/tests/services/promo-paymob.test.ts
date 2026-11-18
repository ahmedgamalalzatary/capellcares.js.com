import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { checkoutSessions, orderItems, orders, paymentAttempts, productVariants, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { releaseExpiredCheckoutReservations } from "../../src/modules/checkout/checkout-reservation.repository.js";
import { PaymobMinimumError, submitCheckout } from "../../src/modules/checkout/checkout.service.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { PromoRejectedError } from "../../src/modules/promos/promo-checkout.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(resetApiTestDatabase);

const config = {
  mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
  hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }],
  canInitiatePayments: true, intentionExpirationSeconds: 1800 as const
};
const urls = { notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result" };

async function createCode(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "PAY10", codeNormalized: "PAY10", arName: "خصم", enName: "Pay", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}

async function payload(qty = 2) {
  const ids = await getBaselineIds();
  return {
    ids,
    payload: {
      fullName: "Online Buyer", phone: "01012345678", email: "online@capella.test", governorate: "Cairo", cityArea: "Nasr City",
      addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob" as const, customerId: ids.customerId, promoCode: "pay10",
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty }]
    }
  };
}

let providerOrder = 9100;
async function initiate(body: Awaited<ReturnType<typeof payload>>["payload"], createIntention?: () => Promise<never>) {
  const orderId = ++providerOrder;
  await initiatePaymobCheckout({ payload: body, idempotencyKey: crypto.randomUUID(), config, ...urls,
    createIntention: createIntention ?? (async () => ({ intentionId: `pi_${orderId}`, orderId, clientSecret: "secret", checkoutUrl: "https://checkout" })) });
  return orderId;
}

const paid = (orderId: number, amountCents: number) => ({
  id: orderId + 50_000, order: { id: orderId }, amount_cents: amountCents, currency: "EGP", integration_id: 123,
  success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
  has_parent_transaction: false, is_standalone_payment: true, source_data: { type: "card" }
});

const uses = (codeId: number) => db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, codeId));

test("an online checkout with a code holds one use and saves the code on the session at the discounted amount", async () => {
  const { ids, payload: body } = await payload();
  const codeId = await createCode();
  const price = Number((await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId)))[0]!.sellingPrice);
  await initiate(body);
  const [session] = await db.select().from(checkoutSessions);
  assert.equal(session!.promoCodeText, "PAY10");
  assert.equal(session!.amountCents, Math.round(price * 2 * 90));
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.checkoutSessionId]), [["reserved", session!.id]]);
});

test("a paid checkout creates the order with the code and turns the held use into a used one, without re-checking the code", async () => {
  const { payload: body } = await payload();
  const codeId = await createCode({ totalUsageLimit: 1 });
  const providerOrderId = await initiate(body);
  const [session] = await db.select().from(checkoutSessions);
  // Paused while the customer is on the payment page: the session's fixed amount is still honored.
  await db.update(promoCodes).set({ status: "paused" }).where(eq(promoCodes.id, codeId));

  const result = await processPaymobTransaction(paid(providerOrderId, session!.amountCents));
  assert.equal(result.outcome, "succeeded");
  const [order] = await db.select().from(orders).where(eq(orders.id, result.orderId!));
  assert.equal(order!.promoCodeText, "PAY10");
  assert.equal(order!.promoDiscountCents, session!.promoDiscountCents);
  const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, order!.id));
  assert.ok(Number(item!.promoDiscountAmount) > 0);
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.orderId, use.overLimit]), [["used", order!.id, false]]);
});

test("a second checkout while a single-use code is held by an open payment is told the code is in use", async () => {
  const { payload: body } = await payload(1);
  await createCode({ totalUsageLimit: 1 });
  await initiate(body);
  await assert.rejects(initiate({ ...body, email: "other-tab@capella.test" }),
    (error: unknown) => error instanceof PromoRejectedError && error.rejection.reason === "in_use");
});

test("an expired online checkout gives its held use back", async () => {
  const { payload: body } = await payload();
  const codeId = await createCode();
  await initiate(body);
  await releaseExpiredCheckoutReservations(new Date(Date.now() + 2 * 60 * 60 * 1000));
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "session_expired"]]);
});

test("a checkout refunded before its order existed gives the use back as an early refund", async () => {
  const { payload: body } = await payload();
  const codeId = await createCode();
  await initiate(body);
  await db.update(paymentAttempts).set({ earlyRefundAmountCents: 100 });
  await releaseExpiredCheckoutReservations(new Date(Date.now() + 2 * 60 * 60 * 1000));
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "early_refund"]]);
});

test("a payment provider rejection gives the held use back", async () => {
  const { payload: body } = await payload();
  const codeId = await createCode();
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  await assert.rejects(initiate(body, async () => { throw new PaymobProviderError("rejected", { status: 400 }); }));
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "payment_failed"]]);
});

test("a paid order that staff deny after refunding gives the code use back", async () => {
  const { payload: body } = await payload();
  const codeId = await createCode();
  const providerOrderId = await initiate(body);
  const [session] = await db.select().from(checkoutSessions);
  const result = await processPaymobTransaction(paid(providerOrderId, session!.amountCents));
  await db.update(orders).set({ providerPaymentStatus: "refunded", refundedAmountCents: session!.amountCents }).where(eq(orders.id, result.orderId!));
  const { updateOrderPaymentStatusRepo } = await import("../../src/modules/orders/order.repository.js");
  await updateOrderPaymentStatusRepo(result.orderId!, "denied");
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "denied"]]);
});

test("a held use whose hold was released is still honored when the payment creates the order, marked over the limit", async () => {
  const { payload: body } = await payload();
  const codeId = await createCode({ totalUsageLimit: 1 });
  const providerOrderId = await initiate(body);
  const [session] = await db.select().from(checkoutSessions);
  await db.update(promoRedemptions).set({ state: "released", releaseReason: "session_expired" }).where(eq(promoRedemptions.promoCodeId, codeId));
  const result = await processPaymobTransaction(paid(providerOrderId, session!.amountCents));
  assert.equal(result.outcome, "succeeded");
  assert.deepEqual((await uses(codeId)).map((use) => [use.state, use.overLimit, use.releaseReason]), [["used", true, null]]);
});

test("online payment below EGP 10 is refused so the customer pays cash on delivery", async () => {
  const { payload: body } = await payload(1);
  await createCode({ discountType: "fixed", discountValue: "99999.00" });
  const price = Number((await db.select().from(productVariants).where(eq(productVariants.id, body.items[0]!.variantId)))[0]!.sellingPrice);
  await db.update(promoCodes).set({ discountValue: (price - 5).toFixed(2) });
  await assert.rejects(submitCheckout(body, { idempotencyKey: crypto.randomUUID() }), (error: unknown) => error instanceof PaymobMinimumError);
});
