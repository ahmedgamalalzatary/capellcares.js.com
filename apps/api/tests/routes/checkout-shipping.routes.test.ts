import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { app } from "../../src/app.js";
import { withTestServer } from "../helpers/request.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { selectedDestination, shippingBuyer, withShippingEnvironment } from "../helpers/checkout-shipping.js";

beforeEach(resetApiTestDatabase);
test("inactive shipping reports the legacy checkout mode without provider calls", async () => {
  await withTestServer(app, async request => {
    const response = await request("/api/v1/checkout/shipping");
    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { enabled: false, addresses: [] });
  });
});
test("enabled shipping issues a server-priced guest quote and requires it at checkout", async () => {
  await withShippingEnvironment(async () => {
    const ids = await getBaselineIds();
    const payload = { ...shippingBuyer, items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], shippingAddress: selectedDestination };
    await withTestServer(app, async request => {
      const addresses = await request("/api/v1/checkout/shipping");
      assert.equal(addresses.status, 200);
      assert.equal(addresses.json.addresses[0].districtId, "district-nasr");
      const quote = await request("/api/v1/checkout/shipping/quote", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, productsTotalCents: 1, shippingAmountCents: 0 }) });
      assert.equal(quote.status, 201);
      assert.equal(quote.json.productsTotalCents, 3500);
      assert.equal(quote.json.amountCents, 13229);
      assert.equal(quote.json.codAmountCents, 13229);
      const noQuote = await request("/api/v1/checkout", { method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ ...shippingBuyer, items: payload.items }) });
      assert.equal(noQuote.status, 409);
      assert.equal(noQuote.json.code, "SHIPPING_QUOTE_CHANGED");
      const result = await request("/api/v1/checkout", { method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ ...payload, shippingQuoteId: quote.json.quoteId, expectedAmountCents: 13229 }) });
      assert.equal(result.status, 201);
      assert.equal(result.json.paymentStatus, "pending");
    });
  });
});
test("enabled but unverified shipping returns a recoverable error and never falls back to zero", async () => {
  await withShippingEnvironment(async () => {
    await withTestServer(app, async request => {
      const response = await request("/api/v1/checkout/shipping");
      assert.equal(response.status, 503);
      assert.equal(response.json.code, "SHIPPING_UNAVAILABLE");
      assert.equal(JSON.stringify(response.json).includes("fixture-secret"), false);
    });
  }, false);
});
