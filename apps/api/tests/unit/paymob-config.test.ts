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

test("resolvePaymobConfig rejects an unrecognized mode instead of silently treating it as test", async () => {
  // A typo silently became `test`, which is indistinguishable from a deliberately
  // unconfigured deployment: live payments would be aimed at the sandbox. A mode must be
  // one of the two documented values.
  const module = await import("../../src/modules/payments/paymob/paymob-config.js").catch(() => null);
  for (const mode of ["livee", "TEST", "Live", "production", "1"]) {
    assert.throws(() => module?.resolvePaymobConfig({ PAYMOB_MODE: mode }),
      /PAYMOB_MODE|mode/i, `mode ${JSON.stringify(mode)} must fail loudly`);
  }
  assert.equal(module?.resolvePaymobConfig({ PAYMOB_MODE: "live" }).mode, "live");
  assert.equal(module?.resolvePaymobConfig({ PAYMOB_MODE: "test" }).mode, "test");
});

test("resolvePaymobConfig accepts an absent mode as an explicit test default", async () => {
  // Unset is the normal local case and must not be an error, but it is recorded as `test`
  // once here rather than guessed at each use site.
  const module = await import("../../src/modules/payments/paymob/paymob-config.js");
  assert.equal(module.resolvePaymobConfig({}).mode, "test");
  assert.equal(module.resolvePaymobConfig({ PAYMOB_MODE: "  " }).mode, "test");
});

test("an integration confirmation typo fails instead of silently disabling the method", async () => {
  // `PAYMOB_CARD_INTEGRATION_CONFIRMED=yes` is not "true", so the card method quietly
  // vanished and customers were told their card was unavailable.
  const module = await import("../../src/modules/payments/paymob/paymob-config.js").catch(() => null);
  for (const value of ["yes", "1", "TRUE", "True", "on"]) {
    assert.throws(() => module?.resolvePaymobConfig({
      PAYMOB_MODE: "test", PAYMOB_SECRET_KEY: "sk", PAYMOB_PUBLIC_KEY: "pk", PAYMOB_HMAC_SECRET: "h",
      PAYMOB_CARD_INTEGRATION_ID: "5885253", PAYMOB_CARD_INTEGRATION_CONFIRMED: value
    }), /CONFIRMED|confirmation/i, `confirmation ${JSON.stringify(value)} must fail loudly`);
  }
});

test("a confirmed integration with no configured id fails instead of disabling payments", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-config.js").catch(() => null);
  assert.throws(() => module?.resolvePaymobConfig({
    PAYMOB_MODE: "test", PAYMOB_SECRET_KEY: "sk", PAYMOB_PUBLIC_KEY: "pk", PAYMOB_HMAC_SECRET: "h",
    PAYMOB_CARD_INTEGRATION_CONFIRMED: "true"
  }), /PAYMOB_CARD_INTEGRATION_ID|positive integer/i);
});

test("a missing credential is reported when an integration is confirmed, not merely configured", async () => {
  const module = await import("../../src/modules/payments/paymob/paymob-config.js").catch(() => null);
  const env = { PAYMOB_MODE: "test", PAYMOB_SECRET_KEY: "sk", PAYMOB_PUBLIC_KEY: "pk", PAYMOB_HMAC_SECRET: "h",
    PAYMOB_CARD_INTEGRATION_ID: "5885253" };
  // Configuring an id without confirming it is a harmless, still-disabled state.
  assert.doesNotThrow(() => module?.resolvePaymobConfig(env));
  // Confirming it is a promise to take payments, so every required credential must exist.
  assert.throws(() => module?.resolvePaymobConfig({ ...env, PAYMOB_CARD_INTEGRATION_CONFIRMED: "true",
    PAYMOB_HMAC_SECRET: "" }), /HMAC/i);
  assert.throws(() => module?.resolvePaymobConfig({ ...env, PAYMOB_CARD_INTEGRATION_CONFIRMED: "true",
    PAYMOB_SECRET_KEY: "" }), /Secret/i);
  assert.throws(() => module?.resolvePaymobConfig({ ...env, PAYMOB_CARD_INTEGRATION_CONFIRMED: "true",
    PAYMOB_PUBLIC_KEY: "" }), /Public/i);
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
