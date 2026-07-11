import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { adminUserPermissions, adminUsers, orderItems, orders, permissions, reviewSubmissions, reviews } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { syncPermissionCatalog } from "../../src/services/erp-permissions.service.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function createAcceptedProductOrder() {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: `REVIEW-${Date.now()}`,
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    paymentMethod: "cod",
    paymentStatus: "accepted",
    totalAmount: "35.00"
  }).$returningId();
  await db.insert(orderItems).values({
    orderId: order.id,
    itemType: "product_variant",
    variantId: ids.firstVariantId,
    qty: 1,
    unitPrice: "35.00",
    lineTotal: "35.00",
    snapshotNameAr: "منتج تجريبي",
    snapshotNameEn: "Test Product"
  });
  return { ...ids, orderId: order.id };
}

function customerToken(customerId: number) {
  return jwt.sign({ sub: customerId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
}

test("an authenticated customer can submit one pending review for a product in an accepted order", async () => {
  const ids = await createAcceptedProductOrder();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/reviews", {
      method: "POST",
      headers: {
        authorization: `Bearer ${customerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId, rating: 5 })
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.status, "pending");
    assert.equal(response.json.comment, null);
  });
});

test("review submission rejects non-purchases and remains blocked after hard deletion", async () => {
  const ids = await createAcceptedProductOrder();

  await withTestServer(app, async (request) => {
    const headers = {
      authorization: `Bearer ${customerToken(ids.customerId)}`,
      "content-type": "application/json"
    };
    const notPurchased = await request("/api/v1/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ entityType: "product", entityId: ids.productTwoId, rating: 4 })
    });
    assert.equal(notPurchased.status, 403);

    const submitted = await request("/api/v1/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId, rating: 5, comment: "Great" })
    });
    assert.equal(submitted.status, 201);

    const adminHeaders = await getAdminAuthHeaders(request);
    const deleted = await request(`/api/erp/reviews/${submitted.json.id}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    assert.equal(deleted.status, 200);

    const duplicate = await request("/api/v1/reviews", {
      method: "POST",
      headers,
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId, rating: 3 })
    });
    assert.equal(duplicate.status, 409);
  });

  const remainingReviews = await db.select().from(reviews);
  const ledger = await db.select().from(reviewSubmissions);
  assert.equal(remainingReviews.length, 0);
  assert.equal(ledger.length, 1);
});

test("public review reads include only approved reviews and return their summary newest first", async () => {
  const ids = await createAcceptedProductOrder();

  await withTestServer(app, async (request) => {
    const submitted = await request("/api/v1/reviews", {
      method: "POST",
      headers: {
        authorization: `Bearer ${customerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId, rating: 4, comment: "Useful" })
    });
    assert.equal(submitted.status, 201);

    const beforeApproval = await request(`/api/v1/reviews/product/${ids.productOneId}`);
    assert.equal(beforeApproval.status, 200);
    assert.deepEqual(beforeApproval.json.summary, { averageRating: null, reviewCount: 0 });
    assert.deepEqual(beforeApproval.json.items, []);

    const adminHeaders = await getAdminAuthHeaders(request);
    const approved = await request(`/api/erp/reviews/${submitted.json.id}/status`, {
      method: "PATCH",
      headers: { ...adminHeaders, "content-type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    });
    assert.equal(approved.status, 200);

    const publicResponse = await request(`/api/v1/reviews/product/${ids.productOneId}`);
    assert.equal(publicResponse.status, 200);
    assert.deepEqual(publicResponse.json.summary, { averageRating: 4, reviewCount: 1 });
    assert.equal(publicResponse.json.items[0].customerName, "Seed Customer");
    assert.equal(publicResponse.json.items[0].comment, "Useful");
  });
});

test("order eligibility exposes accepted exact entities and becomes submitted after review", async () => {
  const ids = await createAcceptedProductOrder();
  await withTestServer(app, async (request) => {
    const headers = { authorization: `Bearer ${customerToken(ids.customerId)}` };
    const before = await request(`/api/v1/reviews/eligibility/${ids.orderId}`, { headers });
    assert.equal(before.status, 200);
    assert.deepEqual(before.json.items[0], {
      orderItemId: before.json.items[0].orderItemId,
      entityType: "product",
      entityId: ids.productOneId,
      eligible: true,
      submitted: false,
      status: null
    });

    await request("/api/v1/reviews", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ entityType: "product", entityId: ids.productOneId, rating: 5 })
    });
    const after = await request(`/api/v1/reviews/eligibility/${ids.orderId}`, { headers });
    assert.equal(after.json.items[0].eligible, false);
    assert.equal(after.json.items[0].submitted, true);
    assert.equal(after.json.items[0].status, "pending");
  });
});

test("order eligibility returns each resolved review target only once", async () => {
  const ids = await createAcceptedProductOrder();
  await db.insert(orderItems).values({
    orderId: ids.orderId,
    itemType: "product_variant",
    variantId: ids.firstVariantId,
    qty: 2,
    unitPrice: "35.00",
    lineTotal: "70.00",
    snapshotNameEn: "Test Product"
  });

  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/reviews/eligibility/${ids.orderId}`, {
      headers: { authorization: `Bearer ${customerToken(ids.customerId)}` }
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.items.length, 1);
    assert.equal(response.json.items[0].entityType, "product");
    assert.equal(response.json.items[0].entityId, ids.productOneId);
  });
});

test("review ERP routes enforce read, moderate, and delete permissions separately", async () => {
  await withTestServer(app, async (request) => {
    const staff = await getStaffAuthHeaders(request, { email: "review-staff@capella.test" });
    const denied = await request("/api/erp/reviews", { headers: { authorization: staff.authorization } });
    assert.equal(denied.status, 403);

    const [staffUser] = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(eq(adminUsers.email, "review-staff@capella.test")).limit(1);
    await syncPermissionCatalog();
    const [readPermission] = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.key, "reviews.read")).limit(1);
    await db.insert(adminUserPermissions).values({ adminUserId: staffUser.id, permissionId: readPermission.id });

    const allowedList = await request("/api/erp/reviews", { headers: { authorization: staff.authorization } });
    assert.equal(allowedList.status, 200);
    const deniedModerate = await request("/api/erp/reviews/1/status", {
      method: "PATCH",
      headers: { authorization: staff.authorization, "content-type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    });
    assert.equal(deniedModerate.status, 403);
    const deniedDelete = await request("/api/erp/reviews/1", { method: "DELETE", headers: { authorization: staff.authorization } });
    assert.equal(deniedDelete.status, 403);
  });
});

test("accepted offer and collection lines are independently reviewable while pending orders are not", async () => {
  const ids = await getBaselineIds();
  const [acceptedOrder] = await db.insert(orders).values({
    orderCode: `BUNDLES-${Date.now()}`,
    customerType: "registered", customerId: ids.customerId, fullName: "Seed Customer",
    phone: "01012345678", email: "seed-customer@capella.test", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 10", buildingApartment: "4",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "100.00"
  }).$returningId();
  await db.insert(orderItems).values([
    { orderId: acceptedOrder.id, itemType: "offer", offerId: ids.offerId, qty: 1, unitPrice: "50.00", lineTotal: "50.00" },
    { orderId: acceptedOrder.id, itemType: "collection", collectionId: ids.collectionId, qty: 1, unitPrice: "50.00", lineTotal: "50.00" }
  ]);

  const [pendingOrder] = await db.insert(orders).values({
    orderCode: `PENDING-${Date.now()}`,
    customerType: "registered", customerId: ids.customerId, fullName: "Seed Customer",
    phone: "01012345678", email: "seed-customer@capella.test", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 10", buildingApartment: "4",
    paymentMethod: "cod", paymentStatus: "pending", totalAmount: "35.00"
  }).$returningId();
  await db.insert(orderItems).values({
    orderId: pendingOrder.id, itemType: "product_variant", variantId: ids.secondVariantId,
    qty: 1, unitPrice: "35.00", lineTotal: "35.00"
  });

  await withTestServer(app, async (request) => {
    const headers = { authorization: `Bearer ${customerToken(ids.customerId)}`, "content-type": "application/json" };
    for (const target of [
      { entityType: "offer", entityId: ids.offerId },
      { entityType: "collection", entityId: ids.collectionId }
    ]) {
      const response = await request("/api/v1/reviews", {
        method: "POST", headers, body: JSON.stringify({ ...target, rating: 5 })
      });
      assert.equal(response.status, 201);
    }
    const pending = await request("/api/v1/reviews", {
      method: "POST", headers,
      body: JSON.stringify({ entityType: "product", entityId: ids.productTwoId, rating: 5 })
    });
    assert.equal(pending.status, 403);
  });
});
