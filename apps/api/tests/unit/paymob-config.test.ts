import assert from "node:assert/strict";
import test from "node:test";

test("resolvePaymobConfig keeps an unconfirmed VPC integration disabled", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-config.js").catch(() => null);
  const config = module?.resolvePaymobConfig({
    PAYMOB_MODE: "test",
    PAYMOB_SECRET_KEY: "sk_test_value",
    PAYMOB_PUBLIC_KEY: "pk_test_value",
    PAYMOB_HMAC_SECRET: "hmac_value",
    PAYMOB_CARD_INTEGRATION_ID: "5885253"
  });

  assert.deepEqual(config?.enabledMethods, []);
  assert.equal(config?.canInitiatePayments, false);
});

test("resolvePaymobConfig enables only explicitly confirmed integrations", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-config.js").catch(() => null);
  const config = module?.resolvePaymobConfig({
    PAYMOB_MODE: "test",
    PAYMOB_SECRET_KEY: "sk_test_value",
    PAYMOB_PUBLIC_KEY: "pk_test_value",
    PAYMOB_HMAC_SECRET: "hmac_value",
    PAYMOB_CARD_INTEGRATION_ID: "5885253",
    PAYMOB_CARD_INTEGRATION_CONFIRMED: "true",
    PAYMOB_WALLET_INTEGRATION_ID: "6000000"
  });

  assert.deepEqual(config?.enabledMethods, [{ method: "card", integrationId: 5885253 }]);
  assert.equal(config?.canInitiatePayments, true);
  assert.equal(config?.intentionExpirationSeconds, 1800);
});
