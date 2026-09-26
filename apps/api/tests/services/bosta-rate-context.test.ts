import assert from "node:assert/strict";
import test from "node:test";
import { buildRateIdentity } from "../../src/modules/shipping/bosta/bosta-quote.service.js";
import { BOSTA_RATE_CONTEXT as BASE } from "../helpers/bosta.js";

test("saved rate identity isolates every price-affecting context field", () => {
  const key = buildRateIdentity(BASE);
  for (const change of [
    { accountId: "other-account" }, { environment: "https://app.bosta.co/api/v2" },
    { pricingContractId: "contract-v2" }, { pickupCity: "Alexandria" },
    { dropOffCity: "Alexandria" }, { destinationId: "district-2" },
    { size: "medium" as const }, { providerSize: "Other verified size" },
    { serviceType: "exchange" }, { paymentMethod: "cod" as const },
    { paymentMethod: "cod" as const, codAmountCents: 100 }
  ]) {
    assert.notEqual(buildRateIdentity({ ...BASE, ...change }), key, JSON.stringify(change));
  }
  assert.equal(buildRateIdentity({ ...BASE }), key);
  assert.ok(key.length <= 191);
});

test("incomplete and invalid rate contexts cannot identify a saved rate", () => {
  for (const change of [
    { accountId: "" }, { environment: "http://app.bosta.co/api/v2" },
    { pricingContractId: "" }, { pickupCity: " " }, { dropOffCity: "" },
    { destinationId: "" }, { size: "unknown" }, { providerSize: "" },
    { serviceType: "" }, { paymentMethod: "unknown" },
    { codAmountCents: -1 }, { codAmountCents: 0.5 },
    { codAmountCents: 100 }, { paymentMethod: "cod", codAmountCents: 2147483648 }
  ]) {
    assert.throws(() => buildRateIdentity({ ...BASE, ...change } as typeof BASE));
  }
});
