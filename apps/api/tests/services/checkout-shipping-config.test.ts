import assert from "node:assert/strict";
import test from "node:test";
import { BOSTA_RESPONSE_CONTRACT } from "../helpers/bosta.js";

test("inactive shipping needs no account configuration and enabled shipping fails closed without verified COD policy", async () => {
  const module = await import("../../src/modules/shipping/checkout-shipping-runtime.js").catch(() => null);
  assert.ok(module?.checkoutShippingServiceFromEnvironment);
  assert.equal(module.checkoutShippingServiceFromEnvironment({}), null);
  const env = { BOSTA_ENABLED: "true", BOSTA_API_KEY: "fixture", BOSTA_WEBHOOK_SECRET: "fixture",
    BOSTA_BASE_URL: "https://stg-app.bosta.co/api/v2" };
  assert.throws(() => module.checkoutShippingServiceFromEnvironment(env), /unavailable/i);
  const settings = { accountVerified: true, accountEvidence: "synthetic fixture", accountId: "fixture",
    pickupCity: "Cairo", codUnit: "major", sizeMapping: { small: "Normal", medium: "FixtureMedium", large: "FixtureLarge" }, responseContract: BOSTA_RESPONSE_CONTRACT };
  assert.throws(() => module.checkoutShippingServiceFromEnvironment({ ...env, BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify(settings) }), /unavailable/i);
  assert.throws(() => module.checkoutShippingServiceFromEnvironment({ ...env, BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify({ ...settings, accountVerified: false, codPricingPolicy: "collection_total" }) }), /unavailable/i);
  assert.ok(module.checkoutShippingServiceFromEnvironment({ ...env, BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify({ ...settings, codPricingPolicy: "collection_total" }) }));
});

const shippingSettings = (accountId: string) => ({
  accountVerified: true, accountEvidence: "synthetic fixture", accountId, pickupCity: "Cairo",
  codUnit: "major", codPricingPolicy: "collection_total",
  sizeMapping: { small: "Normal", medium: "FixtureMedium", large: "FixtureLarge" },
  responseContract: BOSTA_RESPONSE_CONTRACT
});
const shippingEnv = (accountId: string, baseUrl = "https://stg-app.bosta.co/api/v2") => ({
  BOSTA_ENABLED: "true", BOSTA_API_KEY: "fixture", BOSTA_WEBHOOK_SECRET: "fixture",
  BOSTA_BASE_URL: baseUrl, BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify(shippingSettings(accountId))
});

test("an unchanged shipping configuration reuses one provider/address service instance", async () => {
  const module = await import("../../src/modules/shipping/checkout-shipping-runtime.js");
  const env = shippingEnv(`reuse-${crypto.randomUUID()}`);
  const first = module.checkoutShippingServiceFromEnvironment(env);
  const second = module.checkoutShippingServiceFromEnvironment(env);
  assert.ok(first);
  assert.equal(first, second, "the same configuration must reuse one service so its address cache survives across requests");
});

test("a changed account or environment never reuses another account's snapshot", async () => {
  const module = await import("../../src/modules/shipping/checkout-shipping-runtime.js");
  const env = shippingEnv(`identity-${crypto.randomUUID()}`);
  const first = module.checkoutShippingServiceFromEnvironment(env);
  const second = module.checkoutShippingServiceFromEnvironment({ ...env,
    BOSTA_QUOTE_SETTINGS_JSON: JSON.stringify(shippingSettings("a-different-account")) });
  assert.notEqual(first, second, "a different account must not inherit a stale cached snapshot");
});

test("a cached service is rebuilt once its snapshot expires", async (t) => {
  t.mock.timers.enable({ apis: ["Date"] });
  const module = await import("../../src/modules/shipping/checkout-shipping-runtime.js");
  const env = shippingEnv(`expiry-${crypto.randomUUID()}`);
  const first = module.checkoutShippingServiceFromEnvironment(env);
  t.mock.timers.tick(31_000);
  const second = module.checkoutShippingServiceFromEnvironment(env);
  assert.notEqual(first, second, "the snapshot must expire rather than live forever");
  t.mock.timers.reset();
});
