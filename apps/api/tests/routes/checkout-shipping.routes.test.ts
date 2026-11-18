import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { app } from "../../src/app.js";
import { withTestServer } from "../helpers/request.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { selectedDestination, shippingBuyer, withShippingEnvironment } from "../helpers/checkout-shipping.js";
import jwt from "jsonwebtoken";
import { db } from "@capella/database/src/db";
import { promoCodes } from "@capella/database/drizzle/schema";

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

test("a delivery quote with a code that no longer applies answers with the code's reason instead of quoting the full price", async () => {
  await withShippingEnvironment(async () => {
    const ids = await getBaselineIds();
    await db.insert(promoCodes).values({ code: "BIGONLY", codeNormalized: "BIGONLY", arName: "خصم", enName: "Big", status: "active",
      startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", minOrderAmount: "99999.00" });
    const token = jwt.sign({ sub: ids.customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
    await withTestServer(app, async request => {
      const quote = await request("/api/v1/checkout/shipping/quote", { method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], paymentMethod: "cod",
          shippingAddress: selectedDestination, promoCode: "bigonly" }) });
      assert.equal(quote.status, 409, JSON.stringify(quote.json));
      assert.equal(quote.json.code, "PROMO_REJECTED");
      assert.equal(quote.json.promo.reason, "below_min");
    });
  });
});
