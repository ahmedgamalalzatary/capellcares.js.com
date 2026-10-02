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

test("an unsigned is_live flag cannot steer acceptance in either direction", async () => {
  // `is_live` is NOT in Paymob's HMAC input list. The environment that governs a callback
  // is therefore the one recorded on the LOCAL attempt that created the intention, never the
  // callback's own unsigned claim. Flipping the flag must change no outcome at all: it can
  // neither force acceptance nor block a genuine payment.
  await checkout();
  assert.equal((await processPaymobTransaction(transaction({ is_live: true }))).outcome, "succeeded",
    "a callback claiming live must not reject a test attempt created against test");
  assert.equal((await db.select().from(orders)).length, 1);

  // And a live attempt is equally unsteered: a callback whose flag claims "test" must not
  // block a genuine live refund.
  await db.update(paymentAttempts).set({ environment: "live" });
  assert.equal((await processPaymobTransaction(transaction({ is_refunded: true, is_live: false }),
    { verified: { is_refunded: true, refunded_amount_cents: 3500, environment: "live" } })).outcome, "refunded",
    "a callback claiming test must not block a refund on a live attempt");
});

test("the audit fingerprint does not let an unsigned environment flag mint a distinct event", async () => {
  // Because is_live is unsigned, one validly signed callback could be replayed with the flag
  // flipped to manufacture unlimited distinct receipts and audit rows. The flag must not
  // participate in the audit identity at all.
  await checkout();
  await processPaymobTransaction(transaction(), { audit: { transaction: transaction() } });
  await processPaymobTransaction(transaction({ is_live: true }), { audit: { transaction: transaction({ is_live: true }) } });
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 1,
    "an unsigned environment flag must not create a second audit identity");
});

test("the inbox fingerprint does not let an unsigned environment flag mint a distinct receipt", async () => {
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction({ is_live: true }) });
  assert.equal((await db.select().from(paymobCallbackInbox)).length, 1,
    "one signed callback replayed with a flipped flag is one event, not two pieces of work");
});

test("a refund is applied on verified evidence even when the unsigned environment claim disagrees", async () => {
  await checkout();
  await processPaymobTransaction(transaction());
  const outcome = await processPaymobTransaction(transaction({ is_refunded: true, is_live: true,
    refunded_amount_cents: 3500 }), { verified: { is_refunded: true, refunded_amount_cents: 3500 } });
  assert.equal(outcome.outcome, "refunded");
  assert.equal((await db.select().from(orders))[0].refundedAmountCents, 3500,
    "an unsigned flag must not block a genuine refund");
});

test("a refund inquiry answering about a different transaction is never applied", async () => {
  // The authenticated read must describe the same payment the SIGNED callback describes.
  // `order.id` and `integration_id` are both inside the HMAC input list, so a disagreement
  // means the provider answered about something else - applying its total would move money
  // on the strength of an unrelated read.
  const run = await runner();
  await checkout();
  await receivePaymobCallback({ callbackType: "transaction", transaction: transaction() });
  await run();
  await receivePaymobCallback({ callbackType: "transaction",
    transaction: transaction({ is_refunded: true, refunded_amount_cents: 3500 }) });
  const good = { transactionId: "7401", paymobOrderId: "9401", integrationId: 123, owner: "211",
    environment: "test" as const, amountCents: 3500, currency: "EGP", success: true, pending: false,
    refunded: true, refundedAmountCents: 3500 };
  for (const mismatch of [{ paymobOrderId: "9999" }, { integrationId: 999 }, { transactionId: "9999" }]) {
    await run({ inquiryLookup: async () => ({ ...good, ...mismatch }) });
    assert.equal((await db.select().from(orders))[0].refundedAmountCents, 0,
      `a mismatched inquiry must not move the refund total: ${JSON.stringify(mismatch)}`);
    const [receipt] = await db.select().from(paymobCallbackInbox).where(eq(paymobCallbackInbox.processingStatus, "failed"));
    assert.equal(receipt?.lastError, "REFUND_VERIFICATION_UNRESOLVED",
      "the receipt stays unresolved and retryable rather than being acknowledged as handled");
  }
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
    transactionId: "7401", paymobOrderId: "9401", integrationId: 123, owner: "211", environment: "test",
    amountCents: 3500, currency: "EGP", success: true, pending: false,
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
  const inquiry = (amount: number) => ({ transactionId: "7401", paymobOrderId: "9401", integrationId: 123,
    owner: "211", environment: "test" as const, amountCents: 3500, currency: "EGP", success: true,
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
