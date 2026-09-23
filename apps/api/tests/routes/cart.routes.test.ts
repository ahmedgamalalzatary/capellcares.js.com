import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { customers } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

function signCustomerToken(customerId: number) {
  return jwt.sign(
    { sub: customerId, role: "customer" },
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    { expiresIn: "15m" }
  );
}

test("cart routes reject unauthenticated requests", async () => {
  await withTestServer(app, async (request) => {
    const getResponse = await request("/api/v1/cart", { method: "GET" });
    assert.equal(getResponse.status, 401);

    const putResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: [] })
    });
    assert.equal(putResponse.status, 401);
  });
});

test("cart save and load round-trips product, offer, and collection lines", async () => {
  const ids = await getBaselineIds();
  const accessToken = signCustomerToken(ids.customerId);

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    const emptyResponse = await request("/api/v1/cart", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(emptyResponse.json.lines, []);

    const lines = [
      { type: "product", productId: ids.productOneId, variantId: ids.firstVariantId, qty: 2 },
      { type: "offer", offerId: ids.offerId, qty: 1 },
      { type: "collection", collectionId: ids.collectionId, qty: 3 }
    ];

    const saveResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ lines })
    });
    assert.equal(saveResponse.status, 200);
    assert.deepEqual(saveResponse.json.lines, lines);

    const loadResponse = await request("/api/v1/cart", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(loadResponse.status, 200);
    assert.deepEqual(loadResponse.json.lines, lines);
  });
});

test("cart save clears the stored cart when lines are empty", async () => {
  const ids = await getBaselineIds();
  const accessToken = signCustomerToken(ids.customerId);

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ lines: [{ type: "offer", offerId: ids.offerId, qty: 1 }] })
    });

    const clearResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ lines: [] })
    });
    assert.equal(clearResponse.status, 200);
    assert.deepEqual(clearResponse.json.lines, []);

    const loadResponse = await request("/api/v1/cart", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.deepEqual(loadResponse.json.lines, []);
  });
});

test("cart lines are isolated per customer", async () => {
  const ids = await getBaselineIds();
  const [secondCustomer] = await db
    .insert(customers)
    .values({ name: "Cart Second", email: "cart-second@capella.test", passwordHash: "test-hash" })
    .$returningId();
  const firstToken = signCustomerToken(ids.customerId);
  const secondToken = signCustomerToken(secondCustomer.id);

  await withTestServer(app, async (request) => {
    await request("/api/v1/cart", {
      method: "PUT",
      headers: { authorization: `Bearer ${firstToken}`, "content-type": "application/json" },
      body: JSON.stringify({ lines: [{ type: "offer", offerId: ids.offerId, qty: 1 }] })
    });
    await request("/api/v1/cart", {
      method: "PUT",
      headers: { authorization: `Bearer ${secondToken}`, "content-type": "application/json" },
      body: JSON.stringify({ lines: [{ type: "collection", collectionId: ids.collectionId, qty: 5 }] })
    });

    const firstResponse = await request("/api/v1/cart", {
      method: "GET",
      headers: { authorization: `Bearer ${firstToken}` }
    });
    assert.deepEqual(firstResponse.json.lines, [{ type: "offer", offerId: ids.offerId, qty: 1 }]);

    const secondResponse = await request("/api/v1/cart", {
      method: "GET",
      headers: { authorization: `Bearer ${secondToken}` }
    });
    assert.deepEqual(secondResponse.json.lines, [{ type: "collection", collectionId: ids.collectionId, qty: 5 }]);
  });
});

test("cart save rejects invalid line payloads", async () => {
  const ids = await getBaselineIds();
  const accessToken = signCustomerToken(ids.customerId);

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    const missingQtyResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ lines: [{ type: "product", productId: ids.productOneId, variantId: ids.firstVariantId }] })
    });
    assert.equal(missingQtyResponse.status, 400);

    const unknownTypeResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ lines: [{ type: "gift", giftId: 1, qty: 1 }] })
    });
    assert.equal(unknownTypeResponse.status, 400);

    const zeroQtyResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ lines: [{ type: "offer", offerId: ids.offerId, qty: 0 }] })
    });
    assert.equal(zeroQtyResponse.status, 400);

    const missingLinesResponse = await request("/api/v1/cart", {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({})
    });
    assert.equal(missingLinesResponse.status, 400);

    // A rejected payload must not have overwritten the stored cart.
    const loadResponse = await request("/api/v1/cart", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.deepEqual(loadResponse.json.lines, []);
  });
});
