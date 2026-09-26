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
