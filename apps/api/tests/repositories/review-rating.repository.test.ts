import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { customers, orderItems, orders, reviews } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { listRatingSummaries, safeRatingSummaries } from "../../src/repositories/review.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

/**
 * Reviews are unique per customer and target, so every seeded rating needs its
 * own customer. The order item only has to exist — the card summary never
 * re-checks eligibility, that was settled when the review was created.
 */
async function seedRatings(
  entityType: "product" | "offer" | "collection",
  entityId: number,
  ratings: Array<{ rating: number; status?: "active" | "inactive"; deleted?: boolean }>
) {
  const ids = await getBaselineIds();
  const [order] = await db.insert(orders).values({
    orderCode: `RATING-${entityType}-${entityId}`,
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

  for (const [index, entry] of ratings.entries()) {
    const [customer] = await db.insert(customers).values({
      name: `Rating Customer ${entityType} ${entityId} ${index}`,
      email: `rating-${entityType}-${entityId}-${index}@capella.test`,
      passwordHash: "x"
    }).$returningId();
    await db.insert(reviews).values({
      customerId: customer.id,
      orderItemId: orderItem.id,
      entityType,
      entityId,
      rating: entry.rating,
      comment: "Seeded rating comment",
      status: entry.status ?? "active",
      deletedAt: entry.deleted ? new Date() : null
    });
  }
}

test("listRatingSummaries averages the visible ratings of each requested entity", async () => {
  const ids = await getBaselineIds();
  await seedRatings("product", ids.productOneId, [{ rating: 5 }, { rating: 4 }, { rating: 3 }]);

  const summaries = await listRatingSummaries("product", [ids.productOneId]);

  assert.deepEqual(summaries.get(ids.productOneId), { average: 4, count: 3 });
});

test("listRatingSummaries rounds the average to one decimal", async () => {
  const ids = await getBaselineIds();
  await seedRatings("product", ids.productOneId, [{ rating: 5 }, { rating: 4 }]);

  const summaries = await listRatingSummaries("product", [ids.productOneId]);

  assert.deepEqual(summaries.get(ids.productOneId), { average: 4.5, count: 2 });
});

test("listRatingSummaries ignores hidden and soft-deleted reviews", async () => {
  const ids = await getBaselineIds();
  await seedRatings("product", ids.productOneId, [
    { rating: 4 },
    { rating: 1, status: "inactive" },
    { rating: 1, deleted: true }
  ]);

  const summaries = await listRatingSummaries("product", [ids.productOneId]);

  assert.deepEqual(summaries.get(ids.productOneId), { average: 4, count: 1 });
});

test("listRatingSummaries omits entities that have no visible review", async () => {
  const ids = await getBaselineIds();
  await seedRatings("product", ids.productOneId, [{ rating: 5 }]);

  const summaries = await listRatingSummaries("product", [ids.productOneId, ids.productTwoId]);

  assert.equal(summaries.has(ids.productTwoId), false);
});

test("listRatingSummaries keeps each entity type separate", async () => {
  const ids = await getBaselineIds();
  await seedRatings("offer", ids.offerId, [{ rating: 2 }]);
  await seedRatings("collection", ids.collectionId, [{ rating: 5 }, { rating: 4 }]);

  const [offerSummaries, collectionSummaries, productSummaries] = await Promise.all([
    listRatingSummaries("offer", [ids.offerId]),
    listRatingSummaries("collection", [ids.collectionId]),
    // A product sharing an id with a rated offer must not inherit its rating.
    listRatingSummaries("product", [ids.offerId])
  ]);

  assert.deepEqual(offerSummaries.get(ids.offerId), { average: 2, count: 1 });
  assert.deepEqual(collectionSummaries.get(ids.collectionId), { average: 4.5, count: 2 });
  assert.equal(productSummaries.has(ids.offerId), false);
});

test("listRatingSummaries returns an empty map without querying for no ids", async () => {
  const summaries = await listRatingSummaries("product", []);

  assert.equal(summaries.size, 0);
});

test("safeRatingSummaries reports no ratings rather than failing the listing that asked", async () => {
  const ids = await getBaselineIds();
  await seedRatings("product", ids.productOneId, [{ rating: 5 }]);
  (db as any).select = () => {
    throw new Error("reviews table unavailable");
  };

  try {
    const summaries = await safeRatingSummaries("product", [ids.productOneId]);
    assert.equal(summaries.size, 0);
  } finally {
    delete (db as any).select;
  }

  // The stub is gone, so the same call now reports the rating it skipped.
  const restored = await safeRatingSummaries("product", [ids.productOneId]);
  assert.deepEqual(restored.get(ids.productOneId), { average: 5, count: 1 });
});

test("safeRatingSummaries still reports the real ratings when the read succeeds", async () => {
  const ids = await getBaselineIds();
  await seedRatings("product", ids.productOneId, [{ rating: 5 }, { rating: 4 }]);

  const summaries = await safeRatingSummaries("product", [ids.productOneId]);

  assert.deepEqual(summaries.get(ids.productOneId), { average: 4.5, count: 2 });
});
