import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";

import { orderItems, orders } from "@capella/database/drizzle/schema";
import { db, mysqlPool } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { createVerifiedReview, ReviewEligibilityError } from "../../src/repositories/review.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function issueCustomerToken(customerId: number) {
  return jwt.sign({ sub: customerId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("review creation rejects numeric strings instead of coercing them", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/reviews", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        entityType: "product",
        entityId: String(ids.productOneId),
        rating: "5",
        comment: "Excellent product"
      })
    });

    assert.equal(response.status, 400);
  });
});

test("an authenticated customer can review an exact item from an accepted order", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-001",
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
    lineTotal: "35.00",
    snapshotNameAr: "منتج تجريبي",
    snapshotNameEn: "Baseline Product 1",
    snapshotSizeLabel: "100ml"
  });

  const revalidationCalls: unknown[] = [];
  const originalFetch = globalThis.fetch;
  const originalNodeEnv = process.env.NODE_ENV;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    revalidationCalls.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  process.env.NODE_ENV = "development";

  try {
    await withTestServer(app, async (request) => {
    const response = await request("/api/v1/reviews", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        entityType: "product",
        entityId: ids.productOneId,
        rating: 5,
        comment: "Excellent product"
      })
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.entityType, "product");
    assert.equal(response.json.entityId, ids.productOneId);
    assert.equal(response.json.rating, 5);
    assert.equal(response.json.comment, "Excellent product");
    assert.equal(response.json.status, "active");
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  }

  assert.deepEqual(revalidationCalls, [{ entity: "product", slug: "test-product-baseline-1" }]);
});

test("a pending order does not qualify a customer to review its item", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-PENDING",
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
    paymentStatus: "pending",
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
    const response = await request("/api/v1/reviews", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        entityType: "product",
        entityId: ids.productOneId,
        rating: 4,
        comment: "Not eligible yet"
      })
    });

    assert.equal(response.status, 403);
    assert.equal(response.json.message, "A paid purchase is required to review this item");
  });
});

test("review creation rechecks accepted payment under the order lock", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-PAYMENT-RACE",
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

  const connection = await mysqlPool.getConnection();
  await connection.beginTransaction();
  let transactionOpen = true;
  try {
    await connection.query("SELECT id FROM orders WHERE id = ? FOR UPDATE", [order.id]);
    const submission = createVerifiedReview({
      customerId: ids.customerId,
      entityType: "product",
      entityId: ids.productOneId,
      rating: 5,
      comment: "Should no longer qualify"
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    await connection.query("UPDATE orders SET payment_status = 'denied' WHERE id = ?", [order.id]);
    await connection.commit();
    transactionOpen = false;

    await assert.rejects(submission, ReviewEligibilityError);
  } finally {
    if (transactionOpen) await connection.rollback();
    connection.release();
  }
});

test("a customer cannot submit a second review for the same entity", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-ONCE",
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
    const init = {
      method: "POST",
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        entityType: "product",
        entityId: ids.productOneId,
        rating: 5,
        comment: "Excellent product"
      })
    } satisfies RequestInit;

    assert.equal((await request("/api/v1/reviews", init)).status, 201);
    const duplicate = await request("/api/v1/reviews", init);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.json.message, "You have already reviewed this item");
  });
});

test("public review listing exposes active review summaries without customer-private data", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-PUBLIC",
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
    const created = await request("/api/v1/reviews", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        entityType: "product",
        entityId: ids.productOneId,
        rating: 4,
        comment: "Works very well"
      })
    });
    assert.equal(created.status, 201);

    const response = await request(`/api/v1/reviews/product/${ids.productOneId}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.json.summary, {
      averageRating: 4,
      reviewCount: 1,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 0 }
    });
    assert.equal(response.json.items.length, 1);
    assert.deepEqual(
      Object.keys(response.json.items[0]).sort(),
      ["comment", "createdAt", "firstName", "id", "rating", "verifiedPurchase"].sort()
    );
    assert.equal(response.json.items[0].firstName, "Seed");
    assert.equal(response.json.items[0].verifiedPurchase, true);
    assert.equal(response.json.items[0].comment, "Works very well");
    assert.deepEqual(response.json.pagination, { page: 1, pageSize: 10, total: 1, totalPages: 1 });
  });
});

test("the one-time prompt claims only the newest eligible purchased item", async () => {
  const ids = await getBaselineIds();
  const [olderOrder] = await db.insert(orders).values({
    orderCode: "REVIEW-PROMPT-OLDER",
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
    orderId: olderOrder.id,
    itemType: "product_variant",
    variantId: ids.firstVariantId,
    qty: 1,
    unitPrice: "35.00",
    lineTotal: "35.00"
  });
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-PROMPT",
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
    totalAmount: "70.00"
  }).$returningId();
  await db.insert(orderItems).values({
    orderId: order.id,
    itemType: "offer",
    offerId: ids.offerId,
    qty: 1,
    unitPrice: "70.00",
    lineTotal: "70.00",
    snapshotNameAr: "عرض تجريبي",
    snapshotNameEn: "Baseline Offer"
  });

  await withTestServer(app, async (request) => {
    const headers = { authorization: `Bearer ${issueCustomerToken(ids.customerId)}` };
    const response = await request("/api/v1/reviews/prompt/claim", { method: "POST", headers });

    assert.equal(response.status, 200);
    assert.equal(response.json.entityType, "offer");
    assert.equal(response.json.entityId, ids.offerId);
    assert.deepEqual(response.json.name, { ar: "عرض تجريبي", en: "Baseline Offer" });
    assert.equal(response.json.href, "/offers/test-offer-baseline");

    const secondResponse = await request("/api/v1/reviews/prompt/claim", { method: "POST", headers });
    assert.equal(secondResponse.status, 204);
    assert.equal(secondResponse.json, null);
  });
});

test("customer order detail marks an accepted exact item as reviewable", async () => {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: "REVIEW-ORDER",
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
    const response = await request(`/api/v1/orders/${order.id}`, {
      headers: { authorization: `Bearer ${issueCustomerToken(ids.customerId)}` }
    });

    assert.equal(response.status, 200);
    assert.deepEqual(response.json.items[0].review, {
      entityType: "product",
      entityId: ids.productOneId,
      state: "eligible"
    });
  });
});

test("product detail includes its public review data", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/products/test-product-baseline-1");

    assert.equal(response.status, 200);
    assert.deepEqual(response.json.reviewData.summary, {
      averageRating: 0,
      reviewCount: 0,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 }
    });
  });
});

test("offer detail includes its public review data", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/offers/test-offer-baseline");

    assert.equal(response.status, 200);
    assert.equal(response.json.reviewData.summary.reviewCount, 0);
  });
});

test("collection detail includes its public review data", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/collections/test-collection-baseline");

    assert.equal(response.status, 200);
    assert.equal(response.json.reviewData.summary.reviewCount, 0);
  });
});
