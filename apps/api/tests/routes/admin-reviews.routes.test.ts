import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { orderItems, orders, reviews } from "@capella/database/drizzle/schema";
import { db, mysqlPool } from "@capella/database/src/db";
import { permanentlyDeleteReview } from "../../src/repositories/review.repository.js";
import { app } from "../../src/app.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { updateAdminUserPermissions } from "../../src/services/erp-permissions.service.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

beforeEach(async () => {
  await resetApiTestDatabase();
});

async function seedReview() {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "ADMIN-REVIEW",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "accepted",
    totalAmount: "35.00"
  }).$returningId();
  const [orderItem] = await db.insert(orderItems).values({
    orderId: order.id,
    itemType: "product_variant",
    variantId: ids.firstVariantId,
    qty: 1,
    unitPrice: "35.00",
    lineTotal: "35.00"
  }).$returningId();
  const [review] = await db.insert(reviews).values({
    customerId: ids.customerId,
    orderItemId: orderItem.id,
    entityType: "product",
    entityId: ids.productOneId,
    rating: 5,
    comment: "Excellent product",
    status: "active"
  }).$returningId();
  return { ...ids, orderId: order.id, reviewId: review.id };
}

test("ERP review listing includes moderation and verified-purchase context", async () => {
  const seeded = await seedReview();

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/reviews", { headers });

    assert.equal(response.status, 200);
    assert.equal(response.json.items.length, 1);
    assert.deepEqual(response.json.items[0], {
      id: seeded.reviewId,
      customerName: "Seed Customer",
      customerEmail: "seed-customer@capella.test",
      entityType: "product",
      entityId: seeded.productOneId,
      entityName: { ar: "منتج تجريبي 1", en: "Baseline Product 1" },
      orderId: seeded.orderId,
      orderCode: "ADMIN-REVIEW",
      rating: 5,
      comment: "Excellent product",
      status: "active",
      deletedAt: null,
      createdAt: response.json.items[0].createdAt
    });
    assert.deepEqual(response.json.pagination, { page: 1, pageSize: 20, total: 1, totalPages: 1 });
  });
});

test("ERP review listing falls back when the reviewed entity no longer exists", async () => {
  const seeded = await seedReview();
  await db.update(reviews).set({ entityId: 999_999 }).where(eq(reviews.id, seeded.reviewId));

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/reviews", { headers });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json.items[0].entityName, { ar: "عنصر محذوف", en: "Deleted item" });
  });
});

test("ERP review trash requires both review-read and trash-read permissions", async () => {
  await seedReview();

  await withTestServer(app, async (request) => {
    const staff = await getStaffAuthHeaders(request, { email: "review-reader@capella.test" });
    await updateAdminUserPermissions("review-reader@capella.test", ["reviews.read"]);
    const headers = { authorization: staff.authorization };

    assert.equal((await request("/api/erp/reviews", { headers })).status, 200);
    assert.equal((await request("/api/erp/reviews?deleted=true", { headers })).status, 403);
  });
});

test("ERP can deactivate and reactivate a review", async () => {
  const seeded = await seedReview();

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const deactivate = await request(`/api/erp/reviews/${seeded.reviewId}/toggle-status`, {
      method: "POST",
      headers
    });
    assert.equal(deactivate.status, 200);
    assert.equal(deactivate.json.status, "inactive");

    const hiddenPublicly = await request(`/api/v1/reviews/product/${seeded.productOneId}`);
    assert.equal(hiddenPublicly.json.summary.reviewCount, 0);

    const reactivate = await request(`/api/erp/reviews/${seeded.reviewId}/toggle-status`, {
      method: "POST",
      headers
    });
    assert.equal(reactivate.status, 200);
    assert.equal(reactivate.json.status, "active");
  });
});

test("ERP soft-deletes reviews into trash and can restore them", async () => {
  const seeded = await seedReview();

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const removed = await request(`/api/erp/reviews/${seeded.reviewId}`, { method: "DELETE", headers });
    assert.equal(removed.status, 200);

    const hiddenPublicly = await request(`/api/v1/reviews/product/${seeded.productOneId}`);
    assert.equal(hiddenPublicly.json.summary.reviewCount, 0);

    const trash = await request("/api/erp/reviews?deleted=true", { headers });
    assert.equal(trash.status, 200);
    assert.equal(trash.json.items.length, 1);
    assert.equal(trash.json.items[0].id, seeded.reviewId);
    assert.ok(trash.json.items[0].deletedAt);

    const restored = await request(`/api/erp/reviews/${seeded.reviewId}/restore`, { method: "POST", headers });
    assert.equal(restored.status, 200);

    const visibleAgain = await request(`/api/v1/reviews/product/${seeded.productOneId}`);
    assert.equal(visibleAgain.json.summary.reviewCount, 1);
  });
});

test("ERP permanently deletes a trashed review without allowing a second submission", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "ADMIN-HARD-REVIEW",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
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
    lineTotal: "35.00"
  });

  await withTestServer(app, async (request) => {
    const customerHeaders = {
      authorization: `Bearer ${jwt.sign({ sub: ids.customerId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" })}`,
      "content-type": "application/json"
    };
    const reviewBody = JSON.stringify({
      entityType: "product",
      entityId: ids.productOneId,
      rating: 5,
      comment: "Excellent product"
    });
    const created = await request("/api/v1/reviews", { method: "POST", headers: customerHeaders, body: reviewBody });
    assert.equal(created.status, 201);

    const adminHeaders = await getAdminAuthHeaders(request);
    assert.equal((await request(`/api/erp/reviews/${created.json.id}`, { method: "DELETE", headers: adminHeaders })).status, 200);
    const removed = await request(`/api/erp/reviews/${created.json.id}/permanent`, { method: "DELETE", headers: adminHeaders });
    assert.equal(removed.status, 200);

    const trash = await request("/api/erp/reviews?deleted=true", { headers: adminHeaders });
    assert.equal(trash.json.items.length, 0);

    const orderDetail = await request(`/api/v1/orders/${order.id}`, { headers: customerHeaders });
    assert.equal(orderDetail.status, 200);
    assert.equal(orderDetail.json.items[0].review.state, "submitted");

    const duplicate = await request("/api/v1/reviews", { method: "POST", headers: customerHeaders, body: reviewBody });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.message, "You have already reviewed this item");
  });
});

test("a concurrent restore wins over permanent deletion of a review", async () => {
  const seeded = await seedReview();
  await db.update(reviews).set({ deletedAt: new Date() }).where(eq(reviews.id, seeded.reviewId));

  const connection = await mysqlPool.getConnection();
  await connection.beginTransaction();
  let transactionOpen = true;
  try {
    await connection.query("SELECT id FROM reviews WHERE id = ? FOR UPDATE", [seeded.reviewId]);
    const deletion = permanentlyDeleteReview(seeded.reviewId);

    await new Promise((resolve) => setTimeout(resolve, 50));
    await connection.query("UPDATE reviews SET deleted_at = NULL WHERE id = ?", [seeded.reviewId]);
    await connection.commit();
    transactionOpen = false;

    assert.equal(await deletion, false);
    const [restored] = await db.select({ deletedAt: reviews.deletedAt }).from(reviews).where(eq(reviews.id, seeded.reviewId));
    assert.ok(restored);
    assert.equal(restored.deletedAt, null);
  } finally {
    if (transactionOpen) await connection.rollback();
    connection.release();
  }
});
