import assert from "node:assert/strict";
import test from "node:test";
import { eq, sql } from "drizzle-orm";

import { classifyReceiptHold, receiptHoldsStock, sqlReceiptHoldsStock } from "../../src/modules/checkout/receipt-hold-policy.js";

test("a success holds stock, because the customer may already have paid", () => {
  assert.deepEqual(classifyReceiptHold({ success: true, pending: false, is_refunded: false }),
    { holds: true, reason: "success" });
});

test("a refund holds stock, and outranks success because it is the later event", () => {
  assert.deepEqual(classifyReceiptHold({ success: true, pending: false, is_refunded: true }),
    { holds: true, reason: "refund" });
});

test("a pending authorisation holds stock, because it can still capture", () => {
  assert.deepEqual(classifyReceiptHold({ success: false, pending: true, is_refunded: false }),
    { holds: true, reason: "pending" });
});

test("a decline does not hold stock, and never could become money", () => {
  // Before this policy every unresolved receipt held stock, so a decline that reached
  // review_required kept an abandoned session's reservation forever - unsellable stock that
  // another customer could never buy.
  assert.deepEqual(classifyReceiptHold({ success: false, pending: false, is_refunded: false }),
    { holds: false, reason: "decline" });
});

test("an unrecognised or malformed payload never asserts a hold", () => {
  // A payload that cannot be read must not be able to hold stock forever; otherwise a
  // stripped or unexpected shape is a permanent leak.
  for (const payload of [null, undefined, {}, "text", 42, { success: "true" },
    { pending: "yes" }, { is_refunded: "true" }]) {
    assert.equal(receiptHoldsStock(payload), false, JSON.stringify(payload) ?? String(payload));
  }
});

test("the SQL predicate used by expiry discovery decides identically to the application form", async () => {
  // Discovery and the per-candidate recheck must never disagree about whether a receipt holds
  // stock. When they did, discovery excluded every eligible session while the recheck would
  // have released it, so the sweep released nothing at all. This runs the generated predicate
  // against a real MySQL JSON column, because MySQL renders JSON booleans as the strings
  // 'true'/'false' - a pure string assertion would not catch a genuine disagreement.
  const { db } = await import("@capella/database/src/db");
  const { paymobCallbackInbox } = await import("@capella/database/drizzle/schema");
  const { resetApiTestDatabase } = await import("../helpers/database.js");
  await resetApiTestDatabase();
  try {
    const cases: Array<[Record<string, unknown>, boolean]> = [
      [{ success: true, pending: false, is_refunded: false }, true],
      [{ success: false, pending: true, is_refunded: false }, true],
      [{ success: true, pending: false, is_refunded: true }, true],
      [{ success: false, pending: false, is_refunded: false }, false],
      [{ success: false, pending: false, is_refunded: false, is_live: true }, false],
      [{ success: true, pending: false, is_refunded: false, refunded_amount_cents: 999999 }, true],
      // A payload whose flags are the STRING "true" rather than JSON booleans. This is the
      // parity trap: JSON_UNQUOTE yields `true` for both, so a value-only SQL comparison
      // calls these a hold while receiptHoldsStock rejects them. The two forms must agree.
      [{ success: "true", pending: false, is_refunded: false }, false],
      [{ success: "true", pending: "true", is_refunded: "true" }, false],
      [{ success: 1, pending: 0, is_refunded: 0 }, false]
    ];
    for (const [payload, holds] of cases) {
      const [row] = await db.insert(paymobCallbackInbox).values({
        eventFingerprint: crypto.randomUUID().replaceAll("-", "").padEnd(64, "0"),
        fingerprintVersion: 3, normalizedPayload: payload, callbackType: "transaction",
        processingStatus: "review_required", nextAttemptAt: new Date(), receivedAt: new Date()
      }).$returningId();
      const [result] = await db.select({ holds: sql<boolean>`${sqlReceiptHoldsStock(paymobCallbackInbox.normalizedPayload)}` })
        .from(paymobCallbackInbox).where(eq(paymobCallbackInbox.id, row.id));
      assert.equal(Boolean(result?.holds), holds, `SQL disagreed with the policy on ${JSON.stringify(payload)}`);
      // The application form must agree on the same stored value, which is the whole point:
      // discovery reads the SQL, the locked recheck reads this function.
      assert.equal(receiptHoldsStock(payload), holds,
        `the policy disagreed with itself on ${JSON.stringify(payload)}`);
    }
  } finally {
    await resetApiTestDatabase();
  }
});

test("no unsigned field can change the classification", () => {
  // is_live and refunded_amount_cents are outside Paymob's HMAC input list, so neither may
  // influence whether stock stays held. Only is_refunded / success / pending decide, and all
  // three ARE signed.
  const signed = { success: false, pending: false, is_refunded: false };
  for (const unsigned of [{ is_live: true }, { is_live: false }, { refunded_amount_cents: 999999 },
    { refunded_amount_cents: 0 }, { owner: 12345 }, { order: { id: 1 } }]) {
    assert.equal(receiptHoldsStock({ ...signed, ...unsigned }), false,
      `${JSON.stringify(unsigned)} must not turn a decline into a hold`);
  }
  const success = { success: true, pending: false, is_refunded: false };
  for (const unsigned of [{ is_live: false }, { is_live: true }, { refunded_amount_cents: 0 }]) {
    assert.equal(receiptHoldsStock({ ...success, ...unsigned }), true,
      `${JSON.stringify(unsigned)} must not drop a genuine success hold`);
  }
});