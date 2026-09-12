import assert from "node:assert/strict";
import test from "node:test";

test("processed callback parser rejects missing payment identity and amount", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-callback.js").catch(() => null);
  const valid = {
    id: 7001, order: { id: 9003 }, amount_cents: 7000, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false,
    source_data: { type: "card", pan: "1234", sub_type: "MasterCard" }
  };
  assert.equal(module?.parsePaymobProcessedCallback({ ...valid, order: {} }), null);
  assert.equal(module?.parsePaymobProcessedCallback({ ...valid, amount_cents: 0 }), null);
  assert.equal(module?.parsePaymobProcessedCallback(valid)?.order.id, 9003);
});
