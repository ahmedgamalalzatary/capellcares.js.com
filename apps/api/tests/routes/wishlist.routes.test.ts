import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { collections, offers, products } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("wishlist routes reject unauthenticated requests", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/wishlist", { method: "GET" });
    assert.equal(response.status, 401);
  });
});

test("wishlist routes add list and remove mixed saved items for an authenticated customer", async () => {
  const ids = await getBaselineIds();
  const accessToken = jwt.sign(
    { sub: ids.customerId, role: "customer" },
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    { expiresIn: "15m" }
  );

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    const addResponse = await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId })
    });
    assert.equal(addResponse.status, 200);

    const addOfferResponse = await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "offer", entityId: ids.offerId })
    });
    assert.equal(addOfferResponse.status, 200);

    const addCollectionResponse = await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "collection", entityId: ids.collectionId })
    });
    assert.equal(addCollectionResponse.status, 200);

    const listResponse = await request("/api/v1/wishlist", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.items.length, 3);
    assert.deepEqual(
      listResponse.json.items.map((item: any) => item.entityType),
      ["product", "offer", "collection"]
    );
    assert.deepEqual(
      listResponse.json.items.map((item: any) => item.entityId),
      [ids.productOneId, ids.offerId, ids.collectionId]
    );
    assert.deepEqual(
      listResponse.json.items.map((item: any) => item.href),
      ["/products/test-product-baseline-1", "/offers/test-offer-baseline", "/collections/test-collection-baseline"]
    );
    assert.deepEqual(
      listResponse.json.items.map((item: any) => item.availability),
      ["available", "available", "available"]
    );

    const removeResponse = await request(`/api/v1/wishlist/product/${ids.productOneId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(removeResponse.status, 200);

    const removeOfferResponse = await request(`/api/v1/wishlist/offer/${ids.offerId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(removeOfferResponse.status, 200);

    const partialListResponse = await request("/api/v1/wishlist", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(partialListResponse.json.items.length, 1);
    assert.equal(partialListResponse.json.items[0].entityType, "collection");

    const removeCollectionResponse = await request(`/api/v1/wishlist/collection/${ids.collectionId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(removeCollectionResponse.status, 200);

    const emptyListResponse = await request("/api/v1/wishlist", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(emptyListResponse.json.items.length, 0);
  });
});

test("wishlist list keeps hidden or inactive entities as unavailable items", async () => {
  const ids = await getBaselineIds();
  const accessToken = jwt.sign(
    { sub: ids.customerId, role: "customer" },
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    { expiresIn: "15m" }
  );

  await db.update(products).set({ status: "inactive" }).where(eq(products.id, ids.productOneId));
  await db.update(offers).set({ visibility: "hidden" }).where(eq(offers.id, ids.offerId));
  await db.update(collections).set({ visibility: "hidden" }).where(eq(collections.id, ids.collectionId));

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId })
    });
    await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "offer", entityId: ids.offerId })
    });
    await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "collection", entityId: ids.collectionId })
    });

    const response = await request("/api/v1/wishlist", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.items.length, 3);
    assert.deepEqual(
      response.json.items.map((item: any) => item.availability),
      ["unavailable", "unavailable", "unavailable"]
    );
  });
});

test("wishlist add accepts legacy productId only for product payloads and rejects mismatched entity types", async () => {
  const ids = await getBaselineIds();
  const accessToken = jwt.sign(
    { sub: ids.customerId, role: "customer" },
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    { expiresIn: "15m" }
  );

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    const legacyProductResponse = await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ productId: ids.productOneId })
    });
    assert.equal(legacyProductResponse.status, 200);

    const mismatchedResponse = await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ entityType: "offer", productId: ids.productOneId })
    });
    assert.equal(mismatchedResponse.status, 400);
    assert.deepEqual(mismatchedResponse.json, { message: "entityType and entityId required" });
  });
});

test("wishlist add rejects missing target entities", async () => {
  const ids = await getBaselineIds();
  const accessToken = jwt.sign(
    { sub: ids.customerId, role: "customer" },
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    { expiresIn: "15m" }
  );

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/wishlist", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ entityType: "product", entityId: ids.collectionId + ids.offerId + ids.productOneId + 9999 })
    });

    assert.equal(response.status, 404);
    assert.deepEqual(response.json, { message: "Wishlist target not found" });
  });
});
