import assert from "node:assert/strict";
import test from "node:test";

const callback = {
  amount_cents: 10000,
  created_at: "2026-09-11T12:00:00Z",
  currency: "EGP",
  error_occured: false,
  has_parent_transaction: false,
  id: 42,
  integration_id: 5885253,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 9001 },
  owner: 7,
  pending: false,
  source_data: { pan: "1234", sub_type: "MasterCard", type: "card" },
  success: true
};

test("verifyPaymobTransactionHmac accepts the documented field order", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-hmac.js").catch(() => null);
  const verified = module?.verifyPaymobTransactionHmac({
    transaction: callback,
    receivedHmac: "b57f14363e3aee75b976893580b3974c953a61378af9fe96968839c1c1cc3a97da2a38bb6643bcc39d577f0188ad546355a5eedc10f9f85379f6be2ef74d270a",
    secret: "test-hmac-secret"
  });

  assert.equal(verified, true);
});

test("verifyPaymobTransactionHmac rejects a modified callback", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-hmac.js").catch(() => null);
  const verified = module?.verifyPaymobTransactionHmac({
    transaction: { ...callback, amount_cents: 10001 },
    receivedHmac: "b57f14363e3aee75b976893580b3974c953a61378af9fe96968839c1c1cc3a97da2a38bb6643bcc39d577f0188ad546355a5eedc10f9f85379f6be2ef74d270a",
    secret: "test-hmac-secret"
  });

  assert.equal(verified, false);
});
