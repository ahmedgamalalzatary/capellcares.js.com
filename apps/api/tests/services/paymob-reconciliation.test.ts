import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { releaseExpiredCheckoutReservations } from "../../src/modules/checkout/checkout-reservation.repository.js";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { PaymobInquiryError } from "../../src/modules/payments/paymob/paymob-inquiry.client.js";

beforeEach(resetApiTestDatabase);

const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "synthetic",
  publicKey: "synthetic", hmacSecret: "synthetic", apiKey: null,
  enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true,
  intentionExpirationSeconds: 1800 as const };
const urls = { notificationUrl: "https://example.invalid/webhook", redirectionUrl: "https://example.invalid/result" };

/** A real checkout whose intention was created (so the attempt holds a provider order id) and whose reservation has since expired — exactly the state a customer leaves behind when the callback never arrives. */
async function missedCallbackCheckout(orderId: number, email: string) {
  const ids = await getBaselineIds();
  const created = await initiatePaymobCheckout({
    payload: { fullName: "Missed Callback", phone: "01012345678", email, governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: crypto.randomUUID(), config, ...urls,
    createIntention: async () => ({ intentionId: `pi_${orderId}`, orderId, clientSecret: "synthetic",
      checkoutUrl: "https://example.invalid" })
  });
  await db.update(checkoutSessions).set({ reservationExpiresAt: new Date(Date.now() - 1000) })
    .where(eq(checkoutSessions.publicId, created.checkoutId));
  const [session] = await db.select({ id: checkoutSessions.id }).from(checkoutSessions)
    .where(eq(checkoutSessions.publicId, created.checkoutId));
  const [attempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, session.id));
  assert.equal(attempt.paymobOrderId, String(orderId), "the fixture must hold the provider order id");
  return { ids, sessionId: session.id, attemptId: attempt.id };
}

const rawTransaction = (orderId: number, extra: Record<string, unknown> = {}) => ({
  id: 9901, order: { id: orderId }, integration_id: 123, owner: 211, is_live: false, amount_cents: 3500,
  currency: "EGP", success: true, pending: false, is_refunded: false, refunded_amount_cents: null,
  is_auth: false, is_capture: false, is_voided: false, has_parent_transaction: false, captured_amount: 3500,
  source_data: { type: "card" }, ...extra });
/** A paid by-order inquiry for `orderId`, shaped exactly like the client's trusted output. */
const paidInquiry = (orderId: number) => ({ transactionId: "9901", paymobOrderId: String(orderId), integrationId: 123,
  owner: "211", environment: "test" as const, amountCents: 3500, currency: "EGP", success: true, pending: false,
  refunded: false, refundedAmountCents: 0, rawTransaction: rawTransaction(orderId) });
const declinedInquiry = (orderId: number) => ({ ...paidInquiry(orderId), success: false,
  rawTransaction: rawTransaction(orderId, { success: false, pending: false, captured_amount: 0 }) });

const stockOf = async (variantId: number) =>
  (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0].stockQty;
const sessionState = async (sessionId: number) =>
  (await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId)))[0].state;
const attemptOf = async (sessionId: number) =>
  (await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, sessionId)))[0];
const runOnce = async (options: { now?: Date; inquiryByOrderId: (orderId: string) => Promise<any> } = {} as any) =>
  (await import("../../src/modules/payments/paymob/paymob-reconciliation.service.js")).runPaymobReconciliationOnce(options);

test("a missed success callback is recovered exactly once through an authenticated order inquiry", async () => {
  const { sessionId } = await missedCallbackCheckout(9401, "recover-once@example.test");
  let calls = 0;
  const inquiry = async (id: string) => { calls += 1; assert.equal(id, "9401"); return paidInquiry(9401); };

  assert.equal(await runOnce({ inquiryByOrderId: inquiry }), true);
  assert.equal((await db.select().from(orders)).length, 1, "the paid checkout becomes an order");
  assert.equal(await sessionState(sessionId), "completed");
  const attempt = await attemptOf(sessionId);
  assert.equal(attempt.status, "succeeded");
  assert.equal(attempt.reconcileNextAt, null, "no hold or retry remains after a proven recovery");

  assert.equal(await runOnce({ inquiryByOrderId: inquiry }), false, "a settled attempt is no longer discovered");
  assert.equal(calls, 1, "a settled payment is never queried again");
  assert.equal((await db.select().from(orders)).length, 1, "the order is created once, never twice");
});

test("an already-settled payment is never inquired about", async () => {
  const { sessionId } = await missedCallbackCheckout(9402, "settled-not-queried@example.test");
  await db.update(paymentAttempts).set({ status: "succeeded" }).where(eq(paymentAttempts.checkoutSessionId, sessionId));
  let calls = 0;
  assert.equal(await runOnce({ inquiryByOrderId: async () => { calls += 1; return paidInquiry(9402); } }), false);
  assert.equal(calls, 0, "only open attempts are reconciled");
});

test("an inquiry outage retries and holds stock instead of releasing a possibly-paid reservation", async () => {
  const { ids, sessionId } = await missedCallbackCheckout(9403, "outage@example.test");
  const down = async () => { throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "synthetic outage"); };

  assert.equal(await runOnce({ inquiryByOrderId: down }), true);
  const attempt = await attemptOf(sessionId);
  assert.ok(["created", "pending"].includes(attempt.status), "an outage must not resolve the attempt");
  assert.ok(attempt.reconcileNextAt && attempt.reconcileNextAt.getTime() > Date.now(), "a bounded retry is scheduled");
  assert.equal(attempt.reconcileAttempts, 1);

  await releaseExpiredCheckoutReservations(new Date(), { reconciliationEnabled: true });
  assert.equal(await stockOf(ids.firstVariantId), 9, "stock stays held while the payment is unproven");
  assert.equal(await sessionState(sessionId), "payment_pending", "the session is not released on a guess");
});

test("a proven no-payment resolves the attempt and lets normal expiry release the stock", async () => {
  const { ids, sessionId } = await missedCallbackCheckout(9404, "no-payment@example.test");

  assert.equal(await runOnce({ inquiryByOrderId: async () => { throw new PaymobInquiryError("PAYMENT_INQUIRY_NOT_FOUND", "none"); } }), true);
  assert.equal((await attemptOf(sessionId)).status, "failed", "a missing transaction is a resolved no-payment");

  await releaseExpiredCheckoutReservations(new Date(), { reconciliationEnabled: true });
  assert.equal(await stockOf(ids.firstVariantId), 10, "a proven non-payment follows the ordinary expiry rules");
  assert.equal(await sessionState(sessionId), "expired");
});

test("a declined transaction also resolves to a releasable no-payment", async () => {
  const { ids, sessionId } = await missedCallbackCheckout(9405, "declined@example.test");
  await runOnce({ inquiryByOrderId: async () => declinedInquiry(9405) });
  assert.equal((await attemptOf(sessionId)).status, "failed");
  assert.equal((await db.select().from(orders)).length, 0, "a decline never creates an order");

  await releaseExpiredCheckoutReservations(new Date(), { reconciliationEnabled: true });
  assert.equal(await stockOf(ids.firstVariantId), 10);
});

test("an inquiry naming a different order is never applied", async () => {
  const { sessionId } = await missedCallbackCheckout(9406, "mismatch@example.test");
  await runOnce({ inquiryByOrderId: async () => ({ ...paidInquiry(9406), paymobOrderId: "9999" }) });
  assert.equal((await db.select().from(orders)).length, 0, "a foreign read must not settle this checkout");
  const attempt = await attemptOf(sessionId);
  assert.ok(attempt.reconcileNextAt, "the attempt stays unresolved and is retried");
  assert.ok(["created", "pending"].includes(attempt.status));
});

test("expiry defers an unreconciled open attempt only while reconciliation is enabled", async () => {
  const { ids, sessionId } = await missedCallbackCheckout(9407, "hold-toggle@example.test");

  await releaseExpiredCheckoutReservations(new Date(), { reconciliationEnabled: true });
  assert.equal(await stockOf(ids.firstVariantId), 9, "an unproven open attempt holds its stock");
  assert.equal(await sessionState(sessionId), "payment_pending");

  // With reconciliation off (no inquiry credential), release behaviour is unchanged — never a silent indefinite hold.
  await releaseExpiredCheckoutReservations(new Date());
  assert.equal(await stockOf(ids.firstVariantId), 10, "expiry still releases when nothing can be inquired");
  assert.equal(await sessionState(sessionId), "expired");
});

test("a persistently unreachable inquiry is parked for staff, bounded, and still holds", async () => {
  const { ids, sessionId } = await missedCallbackCheckout(9408, "park@example.test");
  const down = async () => { throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "synthetic outage"); };
  let now = new Date();
  for (let index = 0; index < 8; index += 1) {
    assert.equal(await runOnce({ now, inquiryByOrderId: down }), true);
    now = new Date(now.getTime() + 120_000);
  }
  const attempt = await attemptOf(sessionId);
  assert.equal(attempt.status, "reconciliation_required", "exhausted retries become visible work, not a silent release");
  assert.equal(attempt.failureCode, "PAYMENT_INQUIRY_UNRESOLVED");

  await releaseExpiredCheckoutReservations(new Date(), { reconciliationEnabled: true });
  assert.equal(await stockOf(ids.firstVariantId), 9, "the visible hold retains the unproven stock");
});

test("concurrent reconciliation sweeps create one order and never double-settle", async () => {
  const { sessionId } = await missedCallbackCheckout(9409, "concurrent@example.test");
  const inquiry = async () => paidInquiry(9409);
  await Promise.all([runOnce({ inquiryByOrderId: inquiry }), runOnce({ inquiryByOrderId: inquiry })]);
  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await attemptOf(sessionId)).status, "succeeded");
});
