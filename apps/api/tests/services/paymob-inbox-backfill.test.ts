import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import { sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts, paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { receivePaymobCallback } from "../../src/modules/payments/paymob/paymob-webhook.service.js";
import { resetApiTestDatabase } from "../helpers/database.js";

const run = promisify(execFile);
const backfill = resolve(import.meta.dirname, "../../../../packages/database/scripts/backfill-paymob-callback-identity.mjs");

beforeEach(resetApiTestDatabase);

/** Rows written as if by the PRE-0063 code: a payload but no identity columns. */
async function legacyReceipt(orderId: string, overrides: Record<string, unknown> = {}) {
  await db.insert(paymobCallbackInbox).values({
    eventFingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
    fingerprintVersion: 2, normalizedPayload: { id: 8801, order: { id: orderId }, integration_id: 123,
      amount_cents: 3500, currency: "EGP", success: true, pending: false },
    callbackType: "transaction", processingStatus: "received", nextAttemptAt: new Date(), receivedAt: new Date(),
    ...overrides
  });
}

async function attemptFor(orderId: string, sessionId: number, attemptNumber = 1) {
  await db.insert(paymentAttempts).values({ checkoutSessionId: sessionId, attemptNumber,
    merchantReference: `ref_${orderId}_${crypto.randomUUID().slice(0, 8)}`, paymobOrderId: orderId,
    amountCents: 3500, currency: "EGP", environment: "test", status: "created" });
}

async function newSession() {
  const [session] = await db.insert(checkoutSessions).values({
    publicId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), customerType: "guest",
    fullName: "Legacy Buyer", phone: "01012345678", email: "legacy@example.test", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]",
    amountCents: 3500, shippingAmountCents: 0, attemptCount: 1, state: "payment_pending",
    reservationExpiresAt: new Date(Date.now() + 900_000)
  }).$returningId();
  return session.id;
}

async function runBackfill() {
  // The script targets DATABASE_URL, which is what an operator would set in production.
  // The tests live in TEST_DATABASE_URL, so it is passed explicitly rather than inheriting
  // whatever DATABASE_URL happens to point at.
  await run("node", [backfill], { env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL } });
}

test("the backfill copies signed identity out of an existing payload without deleting it", async () => {
  await legacyReceipt("9001");
  await runBackfill();
  const rows = await db.select().from(paymobCallbackInbox);
  assert.equal(rows.length, 1, "a receipt is never deleted by the backfill");
  assert.equal(rows[0]!.signedOrderId, "9001");
  assert.equal(rows[0]!.signedIntegrationId, 123);
  assert.equal((rows[0]!.normalizedPayload as Record<string, unknown>).amount_cents, 3500,
    "the payload itself is untouched");
  assert.equal(rows[0]!.processingStatus, "received", "status is untouched");
});

test("the backfill records a binding only when the signed id proves exactly one session", async () => {
  const sessionId = await newSession();
  await attemptFor("9002", sessionId);
  await legacyReceipt("9002");
  await runBackfill();
  assert.equal((await db.select().from(paymobCallbackInbox))[0]!.boundSessionId, sessionId);
});

test("a signed id matching no attempt stays unbound rather than being guessed", async () => {
  await legacyReceipt("424242");
  await runBackfill();
  const [row] = await db.select().from(paymobCallbackInbox);
  assert.equal(row!.signedOrderId, "424242", "the signed id is still retained");
  assert.equal(row!.boundSessionId, null, "an unmatched id is never bound to a session");
});

test("a signed order id is unique per attempt, so a binding is always unambiguous", async () => {
  // `payment_attempts.paymob_order_id` is UNIQUE, which is what makes the backfill's
  // "exactly one session" resolution sound: a signed id cannot name two checkouts. A
  // receipt therefore binds to exactly one session, never an arbitrary one.
  const sessionId = await newSession();
  await attemptFor("9003", sessionId);
  await legacyReceipt("9003");
  await runBackfill();
  assert.equal((await db.select().from(paymobCallbackInbox))[0]!.boundSessionId, sessionId);
});

test("the backfill is idempotent and never overwrites a value that is already indexed", async () => {
  const sessionId = await newSession();
  await attemptFor("9004", sessionId);
  await receivePaymobCallback({ callbackType: "transaction", transaction: { id: 8802, order: { id: "9004" },
    integration_id: 123, amount_cents: 3500, currency: "EGP", success: true, pending: false, is_auth: false,
    is_capture: false, is_refunded: false, is_voided: false, has_parent_transaction: false, is_live: false } });
  const before = (await db.select().from(paymobCallbackInbox))[0]!;
  await runBackfill();
  await runBackfill();
  const after = (await db.select().from(paymobCallbackInbox))[0]!;
  assert.equal(after.signedOrderId, before.signedOrderId);
  assert.equal(after.boundSessionId, before.boundSessionId);
  assert.equal(after.boundSessionId, sessionId);
});

test("a receipt whose payload carries no signed order id is left untouched, not nulled", async () => {
  await legacyReceipt("9005", { normalizedPayload: { id: 8803, integration_id: 123, success: true } });
  await runBackfill();
  const [row] = await db.select().from(paymobCallbackInbox);
  assert.equal(row!.signedOrderId, null, "no identity can be proven, so none is invented");
  assert.equal(row!.boundSessionId, null);
  assert.equal((row!.normalizedPayload as Record<string, unknown>).id, 8803, "the payload survives intact");
});

test("backfilled rows remain visible to the unbound staff queue rather than disappearing", async () => {
  // Non-destructive means the unresolved backlog is still countable and reviewable.
  await legacyReceipt("9006");
  await runBackfill();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(paymobCallbackInbox);
  assert.equal(Number(count), 1);
});