import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { carts, checkoutReservations, checkoutSessions, orders, paymentAttempts, productVariants, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { releaseExpiredCheckoutReservations } from "../../src/modules/checkout/checkout-reservation.repository.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

// A code on an online payment through the whole payment lifecycle: late payment, decline and repeat, early refund, the
// customer's cart and the payment result.
beforeEach(resetApiTestDatabase);

const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
  apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
const urls = { notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result" };
const paid = (providerOrderId: number, amountCents: number, extra: object = {}) => ({ id: providerOrderId + 60_000, order: { id: providerOrderId },
  amount_cents: amountCents, currency: "EGP", integration_id: 123, success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
  is_refunded: false, is_voided: false, has_parent_transaction: false, is_standalone_payment: true, source_data: { type: "card" }, ...extra });
const stockOf = async (variantId: number) => (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stockQty;

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "ROUND2", codeNormalized: "ROUND2", arName: "خصم", enName: "Round", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}

async function buyer(paymentMethod: "cod" | "paymob" = "paymob", qty = 1) {
  const ids = await getBaselineIds();
  return { ids, payload: { fullName: "Round Two", phone: "01012345678", email: "round2@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", paymentMethod, customerId: ids.customerId, promoCode: "round2",
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty }] } };
}

let providerOrder = 9300;
async function initiate(payload: Awaited<ReturnType<typeof buyer>>["payload"], idempotencyKey: string = crypto.randomUUID()) {
  const orderId = ++providerOrder;
  const result = await initiatePaymobCheckout({ payload, idempotencyKey, config, ...urls,
    createIntention: async () => ({ intentionId: `pi_${orderId}`, orderId, clientSecret: `secret_${orderId}`, checkoutUrl: "https://checkout" }) });
  return { providerOrderId: orderId, result };
}

test("a late payment whose saved checkout no longer adds up leaves the released stock alone", async () => {
  const { ids, payload } = await buyer("paymob", 2);
  await code();
  const { providerOrderId } = await initiate(payload);
  const [session] = await db.select().from(checkoutSessions);
  await releaseExpiredCheckoutReservations(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const afterExpiry = await stockOf(ids.firstVariantId);
  await db.update(checkoutSessions).set({ amountCents: session!.amountCents + 1 }).where(eq(checkoutSessions.id, session!.id));

  const result = await processPaymobTransaction(paid(providerOrderId, session!.amountCents));
  assert.equal(result.outcome, "reconciliation_required");
  assert.equal(await stockOf(ids.firstVariantId), afterExpiry);
  assert.deepEqual((await db.select().from(checkoutReservations)).map((row) => row.state), ["released"]);
  assert.equal((await db.select().from(orders)).length, 0);
});

test("repeating an online checkout after its payment was declined starts a fresh attempt instead of reusing the declined link", async () => {
  const { payload } = await buyer();
  await code();
  const key = crypto.randomUUID();
  const { providerOrderId, result: first } = await initiate(payload, key);
  const [session] = await db.select().from(checkoutSessions);
  await processPaymobTransaction(paid(providerOrderId, session!.amountCents, { success: false }));
  const { result: again } = await initiate(payload, key);
  assert.equal(again.checkoutId, first.checkoutId);
  assert.equal((await db.select().from(checkoutSessions))[0]!.attemptCount, 2);
  const attempts = await db.select().from(paymentAttempts).orderBy(paymentAttempts.attemptNumber);
  assert.deepEqual(attempts.map((attempt) => attempt.status === "failed"), [true, false]);
  assert.notEqual(attempts[1]!.clientSecret, attempts[0]!.clientSecret);
});

test("a verified full refund before the order exists gives the code use back straight away", async () => {
  const { payload } = await buyer();
  const codeId = await code({ totalUsageLimit: 1 });
  const { providerOrderId } = await initiate(payload);
  const [session] = await db.select().from(checkoutSessions);
  const refund = await processPaymobTransaction(paid(providerOrderId, session!.amountCents, { is_refunded: true }),
    { verified: { is_refunded: true, refunded_amount_cents: session!.amountCents, environment: "test" } });
  assert.equal(refund.outcome, "refund_pending_success");
  assert.deepEqual((await db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, codeId))).map((use) => [use.state, use.releaseReason]),
    [["released", "early_refund"]]);
});

test("a late payment keeps the cart the customer built after their checkout expired; an on-time payment still empties it", async () => {
  const { ids, payload } = await buyer();
  await code();
  await db.insert(carts).values({ customerId: ids.customerId, lines: [{ type: "product", productId: ids.productOneId, variantId: ids.firstVariantId, qty: 1 }] as never });
  const { providerOrderId } = await initiate(payload);
  const [session] = await db.select().from(checkoutSessions);
  await releaseExpiredCheckoutReservations(new Date(Date.now() + 2 * 60 * 60 * 1000));
  await db.update(carts).set({ lines: [{ type: "product", productId: ids.productTwoId, variantId: ids.secondVariantId, qty: 3 }] as never });
  assert.equal((await processPaymobTransaction(paid(providerOrderId, session!.amountCents))).outcome, "succeeded");
  assert.equal(((await db.select().from(carts))[0]!.lines as unknown[]).length, 1);

  const { providerOrderId: onTime } = await initiate({ ...payload, email: "on-time@capella.test" });
  const [, second] = await db.select().from(checkoutSessions).orderBy(checkoutSessions.id);
  assert.equal((await processPaymobTransaction(paid(onTime, second!.amountCents))).outcome, "succeeded");
  assert.deepEqual((await db.select().from(carts))[0]!.lines, []);
});

test("the payment status shows the code the paid order used and what it saved", async () => {
  const { payload } = await buyer();
  await code();
  const { providerOrderId, result } = await initiate(payload);
  const [session] = await db.select().from(checkoutSessions);
  await processPaymobTransaction(paid(providerOrderId, session!.amountCents));
  await withTestServer(app, async (request) => {
    const status = await request(`/api/v1/checkout/${result.checkoutId}/status`);
    assert.equal(status.status, 200);
    assert.deepEqual(status.json.order.promo, { code: "ROUND2", discountCents: session!.promoDiscountCents });
  });
});
