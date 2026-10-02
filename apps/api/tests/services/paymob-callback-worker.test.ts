import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db, mysqlPool } from "@capella/database/src/db";
import { checkoutSessions, orders, paymentAttempts, paymentWebhookEvents, paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { initiatePaymobCheckout, retryPaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { PaymobProviderError } from "../../src/modules/payments/paymob/paymob-client.js";
import type { PaymobConfig } from "../../src/modules/payments/paymob/paymob-config.js";
import { receivePaymobCallback } from "../../src/modules/payments/paymob/paymob-webhook.service.js";

beforeEach(resetApiTestDatabase);
const config: PaymobConfig = { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "synthetic",
  publicKey: "synthetic", hmacSecret: "synthetic", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
  canInitiatePayments: true, intentionExpirationSeconds: 1800 };
const urls = { notificationUrl: "https://example.invalid/webhook", redirectionUrl: "https://example.invalid/result" };
const transaction = (extra: Record<string, unknown> = {}) => ({ id: 7401, order: { id: 9401 },
  amount_cents: 3500, currency: "EGP", integration_id: 123, success: true, pending: false,
  is_auth: false, is_capture: false, is_refunded: false, is_voided: false, has_parent_transaction: false,
  is_live: false, source_data: { type: "card" }, ...extra });
async function checkout(createIntention?: any, idempotencyKey = crypto.randomUUID()) {
  const ids = await getBaselineIds();
  return initiatePaymobCheckout({ payload: { fullName: "Recovered Buyer", phone: "01012345678",
    email: "recovered@example.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1",
    buildingApartment: "1", paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey, config, ...urls, createIntention: createIntention ?? (async () => ({
      intentionId: "pi_recovered", orderId: 9401, clientSecret: "synthetic", checkoutUrl: "https://example.invalid" })) });
}
async function runner() {
  const module = await import("../../src/modules/payments/paymob/paymob-callback-worker.js").catch(() => null);
  assert.ok(module?.runPaymobCallbackOnce, "durable accepted callbacks need a running recovery sweep");
  return module.runPaymobCallbackOnce;
}

test("an early callback is retained, binds by signed ID and completes after the intention response", async () => {
  const run = await runner();
  await checkout(async () => {
    await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
    await run();
    assert.equal((await db.select().from(orders)).length, 0);
    return { intentionId: "pi_recovered", orderId: 9401, clientSecret: "synthetic", checkoutUrl: "https://example.invalid" };
  });
  await run({ now: new Date(Date.now() + 60_000) });
  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await db.select().from(paymobCallbackInbox))[0].processingStatus, "processed");
});

test("idempotent throttled initiation cannot bypass a queued sibling payment", async () => {
  const key = crypto.randomUUID();
  const first = await checkout(undefined, key);
  await processPaymobTransaction(transaction({ success: false }));
  await assert.rejects(retryPaymobCheckout({ checkoutId: first.checkoutId, config, ...urls,
    createIntention: async () => { throw new PaymobProviderError("synthetic throttle", { status: 429 }); } }));
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  let intentions = 0;
  await assert.rejects(checkout(async () => {
    intentions++;
    return { intentionId: "pi_second", orderId: 9402, clientSecret: "synthetic", checkoutUrl: "https://example.invalid" };
  }, key), (error: any) => error.code === "PAYMENT_EVIDENCE_UNRESOLVED");
  assert.equal(intentions, 0);
});

for (const applied of [false, true]) test(`a later initiation rejection preserves the earlier ${applied ? "completed" : "queued"} payment`, async () => {
  const run = await runner();
  const first = await checkout();
  await processPaymobTransaction(transaction({ success: false }));
  await assert.rejects(retryPaymobCheckout({ checkoutId: first.checkoutId, config, ...urls, createIntention: async () => {
    await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
    if (applied) await run();
    throw new PaymobProviderError("synthetic rejection", { status: 400 });
  } }));
  assert.equal((await db.select().from(checkoutSessions))[0].state, applied ? "completed" : "payment_pending");
  if (!applied) await run();
  assert.equal((await db.select().from(orders)).length, 1, "the older real payment retains its stock and fulfillment");
});

test("a refund inquiry outage recovers without provider redelivery and completes the receipt", async () => {
  const run = await runner();
  await checkout();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  await run();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction({ is_refunded: true, refunded_amount_cents: 3500 }) });
  await run({ inquiryLookup: async () => { throw new Error("synthetic outage"); } });
  assert.equal((await db.select().from(orders))[0].refundedAmountCents, 0);
  const recovered = await run({ now: new Date(Date.now() + 60_000), inquiryLookup: async () => ({
    transactionId: "7401", amountCents: 3500, currency: "EGP", success: true, pending: false,
    refunded: true, refundedAmountCents: 3500 }) });
  assert.equal(recovered, true);
  assert.equal((await db.select().from(orders))[0].refundedAmountCents, 3500);
  assert.ok((await db.select().from(paymobCallbackInbox)).every(row => row.processingStatus === "processed"));
});

test("concurrent recovery sweeps create one order and complete one receipt", async () => {
  const run = await runner();
  await checkout();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  await Promise.all([run(), run()]);
  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await db.select().from(paymobCallbackInbox))[0].processingStatus, "processed");
});

test("a third decline completes its own receipt and releases stock without holding itself", async () => {
  const run = await runner();
  await checkout();
  await db.update(paymentAttempts).set({ attemptNumber: 3 });
  await db.update(checkoutSessions).set({ attemptCount: 3 });
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction({ success: false }) });
  await run();
  assert.equal((await db.select().from(checkoutSessions))[0].state, "expired");
  assert.equal((await db.select().from(paymobCallbackInbox))[0].processingStatus, "processed");
});

test("failure completing the inbox rolls back the order and audit, then recovery commits all three", async () => {
  const run = await runner();
  await checkout();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  const trigger = `test_inbox_${crypto.randomUUID().replaceAll("-", "")}`;
  // Force a real DB error at the LAST write, after order and audit insertion.
  await mysqlPool.query(`CREATE TRIGGER ${trigger} BEFORE UPDATE ON paymob_callback_inbox FOR EACH ROW
    BEGIN IF NEW.processing_status = 'processed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Synthetic inbox failure'; END IF; END`);
  try {
    await run();
    assert.equal((await db.select().from(orders)).length, 0, "the order must share the inbox commit boundary");
    assert.equal((await db.select().from(paymentWebhookEvents)).length, 0, "audit cannot survive a rolled-back order");
    assert.equal((await db.select().from(paymobCallbackInbox))[0].processingStatus, "failed");
  } finally {
    await mysqlPool.query(`DROP TRIGGER ${trigger}`);
  }
  await run({ now: new Date(Date.now() + 60_000) });
  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 1);
  assert.equal((await db.select().from(paymobCallbackInbox))[0].processingStatus, "processed");
});

test("a consumer whose lease was reclaimed cannot commit another refund audit", async () => {
  const run = await runner();
  await checkout();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  await run();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction({ is_refunded: true, refunded_amount_cents: 3500 }) });
  let release: () => void = () => {};
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let started: () => void = () => {};
  const entered = new Promise<void>(resolve => { started = resolve; });
  const now = new Date();
  const inquiry = (amount: number) => ({ transactionId: "7401", amountCents: 3500, currency: "EGP", success: true,
    pending: false, refunded: true, refundedAmountCents: amount });
  const original = run({ now, inquiryLookup: async () => { started(); await waiting; return inquiry(1200); } });
  await entered;
  try {
    await run({ now: new Date(now.getTime() + 121_000), inquiryLookup: async () => inquiry(3500) });
  } finally {
    release();
    await original;
  }
  assert.equal((await db.select().from(orders))[0].refundedAmountCents, 3500);
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 2, "a stale claim must have zero audit effects");
});

test("bound refund receipt shares the order lock with dispatch before publishing its hold", async () => {
  const run = await runner();
  await checkout();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  await run();
  const [order] = await db.select().from(orders);
  const dispatch = await mysqlPool.getConnection();
  const getConnection = mysqlPool.getConnection;
  let intake: Awaited<ReturnType<typeof mysqlPool.getConnection>> | undefined;
  try {
    await dispatch.beginTransaction();
    await dispatch.query("SELECT id FROM orders WHERE id = ? FOR UPDATE", [order.id]);
    mysqlPool.getConnection = async () => {
      intake = await getConnection.call(mysqlPool);
      await intake.query("SET SESSION innodb_lock_wait_timeout = 1");
      return intake;
    };
    await assert.rejects(receivePaymobCallback({ callbackType: "transaction", transaction: transaction({ is_refunded: true }) }),
      (error: any) => {
        assert.equal(error.cause?.code ?? error.code, "ER_LOCK_WAIT_TIMEOUT");
        assert.match(error.query ?? error.cause?.sql, /select.*orders.*for update/i);
        return true;
      });
  } finally {
    mysqlPool.getConnection = getConnection;
    await dispatch.rollback();
    dispatch.release();
    if (intake) await intake.query("SET SESSION innodb_lock_wait_timeout = DEFAULT");
  }
  assert.equal((await db.select().from(paymobCallbackInbox)).length, 1, "blocked intake must not publish an uncommitted hold");
});
