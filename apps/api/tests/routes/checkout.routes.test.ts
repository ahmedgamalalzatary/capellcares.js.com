import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { db } from "@capella/database/src/db";
import { collectionItems, collections, orders } from "@capella/database/drizzle/schema";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function issueCustomerToken(customerId: number) {
  return jwt.sign({ sub: customerId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("checkout route allows guest checkout when the email already exists", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Existing Guest",
        phone: "01012345678",
        email: "seed-customer@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);
    assert.ok(response.json.id);
  });
});

test("checkout route returns a pending COD payment status for a created order", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Pending COD",
        phone: "01012345678",
        email: "pending-cod@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.paymentStatus, "pending");
    assert.match(response.json.orderCode, /^[A-Z]{4}-\d{3,}$/);

    const [order] = await db
      .select({ paymentStatus: orders.paymentStatus, orderCode: orders.orderCode })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.paymentStatus, "pending");
    assert.equal(order?.orderCode, response.json.orderCode);
  });
});

test("checkout route persists registered customer orders for authenticated customers", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`
      },
      body: JSON.stringify({
        fullName: "Registered Customer",
        phone: "01012345678",
        email: "seed-customer@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);

    const [order] = await db
      .select({ customerType: orders.customerType, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.customerType, "registered");
    assert.equal(order?.customerId, ids.customerId);
  });
});

test("checkout route ignores guest-supplied customerId values", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Guest Spoof Attempt",
        phone: "01012345678",
        email: "guest-spoof@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        customerId: ids.customerId,
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);

    const [order] = await db
      .select({ customerType: orders.customerType, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.customerType, "guest");
    assert.equal(order?.customerId, null);
  });
});

test("checkout route uses the authenticated customer id instead of trusting the request body", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`
      },
      body: JSON.stringify({
        fullName: "Authenticated Customer",
        phone: "01012345678",
        email: "seed-customer@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        customerId: ids.customerId + 999,
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);

    const [order] = await db
      .select({ customerType: orders.customerType, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.customerType, "registered");
    assert.equal(order?.customerId, ids.customerId);
  });
});

test("checkout route accepts buyable collection items", async () => {
  const ids = await getBaselineIds();

  const [createdCollection] = await db
    .insert(collections)
    .values({
      slug: `route-collection-${Date.now()}`,
      arName: "مجموعة مسار",
      enName: "Route Collection",
      fixedPrice: "90.00",
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();

  await db.insert(collectionItems).values([
    { collectionId: createdCollection.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: createdCollection.id, variantId: ids.secondVariantId, qty: 1 }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Collection Customer",
        phone: "01012345678",
        email: "collection-route@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "collection", collectionId: createdCollection.id, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);
    assert.ok(response.json.id);
  });
});
