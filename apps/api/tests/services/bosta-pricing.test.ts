import assert from "node:assert/strict";
import test from "node:test";
import {
  BostaPricingService,
  buildShipmentCalculatorQuery
} from "../../src/modules/shipping/bosta/bosta-pricing.service.js";

const BASE = { dropOffCity: "Cairo", pickupCity: "Cairo", cod: 0 };
// Controlled response semantics only; this is not merchant-account evidence.
const CONTRACT = { verified: true, evidence: "controlled test fixture", currency: "EGP" as const,
  unit: "major" as const, amountPath: ["data", "price"], vatIncluded: true, feesIncluded: true };

test("builds the shipment calculator query with the verified size mapping and SEND type", () => {
  const query = buildShipmentCalculatorQuery({ ...BASE, size: "small" }, { small: "Normal" });
  assert.equal(query.get("dropOffCity"), "Cairo");
  assert.equal(query.get("pickupCity"), "Cairo");
  assert.equal(query.get("type"), "SEND");
  assert.equal(query.get("size"), "Normal");
  assert.equal(query.get("cod"), "0");
});

test("an unverified size mapping cannot produce a live quote", async () => {
  // No verified account mapping -> the adapter must not guess a pricing size.
  const service = new BostaPricingService(async () => ({ success: true, data: { price: 97 } }), {});
  await assert.rejects(service.fetchRate({ ...BASE, size: "medium" }), /mapping|unverified|unavailable/i);
});

test("medium and large are not silently mapped to bulky services", async () => {
  // With only a verified small mapping, medium/large have no live quote path.
  const service = new BostaPricingService(async () => ({ success: true, data: { price: 97 } }), { small: "Normal" }, CONTRACT);
  await assert.rejects(service.fetchRate({ ...BASE, size: "medium" }), /mapping|unverified|unavailable/i);
  await assert.rejects(service.fetchRate({ ...BASE, size: "large" }), /mapping|unverified|unavailable/i);
});

test("parses a valid whole-EGP price from a controlled response", async () => {
  const service = new BostaPricingService(async () => ({ success: true, data: { price: 97 } }), { small: "Normal" }, CONTRACT);
  const rate = await service.fetchRate({ ...BASE, size: "small" });
  assert.equal(rate.amountCents, 9_700);
});

test("a valid decimal EGP price converts exactly to cents", async () => {
  const service = new BostaPricingService(async () => ({ success: true, data: { price: 12.5 } }), { small: "Normal" }, CONTRACT);
  const rate = await service.fetchRate({ ...BASE, size: "small" });
  assert.equal(rate.amountCents, 1_250);
});

test("blank and non-decimal strings are rejected, not turned into free shipping", async () => {
  for (const bad of ["", "   ", "0x10", "abc"]) {
    const service = new BostaPricingService(async () => ({ success: true, data: { price: bad } }), { small: "Normal" }, CONTRACT);
    await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /price/i);
  }
});

test("excess-precision and negative prices are rejected, not rounded into a charge", async () => {
  for (const bad of [{ price: 12.345 }, { price: -5 }]) {
    const service = new BostaPricingService(async () => ({ success: true, data: bad }), { small: "Normal" }, CONTRACT);
    await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /price/i);
  }
});

test("rejects a response with no parseable price instead of inventing one", async () => {
  const service = new BostaPricingService(async () => ({ success: true, data: {} }), { small: "Normal" }, CONTRACT);
  await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /price/i);
});

test("size mapping alone cannot enable live pricing", async () => {
  let calls = 0;
  const service = new BostaPricingService(async () => { calls++; return { data: { amount: 1250 } }; }, { small: "Normal" });
  await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /contract|unverified/i);
  assert.equal(calls, 0);
});

test(" unverified units, VAT or fees stop before requesting a price", async () => {
  for (const bad of [{ ...CONTRACT, verified: false }, { ...CONTRACT, vatIncluded: false },
    { ...CONTRACT, feesIncluded: false }, { ...CONTRACT, evidence: "" },
    { ...CONTRACT, currency: "USD" }, { ...CONTRACT, unit: "unknown" }]) {
    let calls = 0;
    const service = new BostaPricingService(async () => { calls++; return { data: { price: 97 } }; }, { small: "Normal" }, bad as typeof CONTRACT);
    await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /contract|unverified/i);
    assert.equal(calls, 0);
  }
});

test(" declared field has no fallback to a different plausible amount field", async () => {
  const service = new BostaPricingService(async () => ({ data: { amount: 1250, total: 97, shippingFees: 97 } }), { small: "Normal" }, CONTRACT);
  await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /price/i);
});

test(" near-cent precision and values outside signed INT storage are rejected", async () => {
  for (const price of [12.500000001, "12.500000001", "90071992547409.90", "21474836.48", 21474836.48]) {
    const service = new BostaPricingService(async () => ({ data: { price } }), { small: "Normal" }, CONTRACT);
    await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /price/i);
  }
});

test(" decimal strings convert exactly through the supported storage boundary", async () => {
  for (const [price, cents] of [["0.29", 29], ["12.50", 1250], ["21474836.47", 2147483647], [0, 0]] as const) {
    const service = new BostaPricingService(async () => ({ data: { price } }), { small: "Normal" }, CONTRACT);
    assert.equal((await service.fetchRate({ ...BASE, size: "small" })).amountCents, cents);
  }
});

test(" declared cents stay cents and reject fractional minor units", async () => {
  const contract = { ...CONTRACT, unit: "minor" as const, amountPath: ["data", "amount"] };
  for (const amount of [1250, "1250"]) {
    const service = new BostaPricingService(async () => ({ data: { amount } }), { small: "Normal" }, contract);
    assert.equal((await service.fetchRate({ ...BASE, size: "small" })).amountCents, 1250);
  }
  for (const amount of [12.5, "12.50", "2147483648"]) {
    const service = new BostaPricingService(async () => ({ data: { amount } }), { small: "Normal" }, contract);
    await assert.rejects(service.fetchRate({ ...BASE, size: "small" }), /price/i);
  }
});
