import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { paymentWebhookEvents, paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { recordPaymobTransaction, receivePaymobCallback } from "../../src/modules/payments/paymob/paymob-webhook.service.js";
import { resetApiTestDatabase } from "../helpers/database.js";

beforeEach(resetApiTestDatabase);

test("recordPaymobTransaction keeps test and live callbacks with the same id distinct", async () => {
  const base = {
    id: 42,
    success: true,
    pending: false,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_voided: false,
    refunded_amount_cents: 0,
    captured_amount: 10000,
    order: { id: 9001 },
    integration_id: 123
  };

  await recordPaymobTransaction({ ...base, is_live: false }, "rejected");
  await recordPaymobTransaction({ ...base, is_live: false }, "rejected");
  await recordPaymobTransaction({ ...base, is_live: true }, "rejected");

  const events = await db.select().from(paymentWebhookEvents);
  assert.equal(events.length, 2, "a duplicate test callback is deduplicated, the live one is not");
});

const callback = (overrides: Record<string, unknown> = {}) => ({
  id: 8801, order: { id: 9001 }, integration_id: 123, amount_cents: 13229, currency: "EGP",
  success: true, pending: false, is_auth: false, is_capture: false, is_voided: false,
  is_refunded: false, has_parent_transaction: false, is_live: false, refunded_amount_cents: 0,
  source_data: { type: "card", pan: "2346", sub_type: "MasterCard" }, ...overrides
});

test("a callback is durably received before processing, and redelivery never duplicates the inbox row", async () => {
  const first = await receivePaymobCallback({ callbackType: "transaction", transaction: callback() });
  const second = await receivePaymobCallback({ callbackType: "transaction", transaction: callback() });
  const rows = await db.select().from(paymobCallbackInbox);
  assert.equal(rows.length, 1, "an identical redelivery collapses to the same inbox row");
  assert.equal(first.id, second.id, "redelivery reports the original row");
  assert.equal(rows[0]!.processingStatus, "received", "receipt is recorded before any processing");
  assert.ok(rows[0]!.receivedAt, "a trusted server receipt time is persisted");
  assert.equal(rows[0]!.hintedTransactionId, "8801");
});

test("the inbox stores only allowlisted fields and never the raw signed body", async () => {
  await receivePaymobCallback({ callbackType: "transaction", transaction: callback({ secret_card_number: "4111111111111111" }) });
  const [row] = await db.select().from(paymobCallbackInbox);
  const stored = JSON.stringify(row!.normalizedPayload);
  assert.equal(stored.includes("secret_card_number"), false, "an unknown field is dropped");
  // source_data.pan is allowlisted for identity, but a full PAN must never be retained.
  assert.equal(stored.includes("2346"), false, "card data is not persisted verbatim");
  assert.equal(stored.includes("4111111111111111"), false);
});

test("a callback whose meaningful fields differ gets its own inbox row", async () => {
  await receivePaymobCallback({ callbackType: "transaction", transaction: callback() });
  await receivePaymobCallback({ callbackType: "transaction", transaction: callback({ amount_cents: 9999 }) });
  await receivePaymobCallback({ callbackType: "transaction", transaction: callback({ is_live: true }) });
  assert.equal((await db.select().from(paymobCallbackInbox)).length, 3, "distinct events are not collapsed");
});

test("receiving a callback does not write to the legacy audit table, and old rows stay readable", async () => {
  await receivePaymobCallback({ callbackType: "transaction", transaction: callback() });
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 0,
    "the inbox is separate from the historical audit log");
  await recordPaymobTransaction(callback(), "processed");
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 1, "the legacy path still works unchanged");
});

test("an unsigned transaction hint is recorded as a hint, never as trusted proof", async () => {
  await receivePaymobCallback({ callbackType: "transaction", transaction: callback({ id: 8801, refunded_amount_cents: 999999 }) });
  const [row] = await db.select().from(paymobCallbackInbox);
  assert.equal(row!.hintedTransactionId, "8801");
  const stored = JSON.stringify(row!.normalizedPayload);
  // refunded_amount_cents is NOT in the HMAC input list, so it must not survive intake as fact.
  assert.equal(stored.includes("999999"), false, "an unsigned refund amount is not persisted as usable evidence");
});
