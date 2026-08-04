import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { customers, orderItems, orders, reviews } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { setRelatedLinksForSourceRepo } from "../../src/repositories/related-item.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

let seedCounter = 0;

/** Seeds visible reviews on a target so its cards have a rating to expose. */
async function seedVisibleReviews(
  entityType: "product" | "offer" | "collection",
  entityId: number,
  ratings: number[]
) {
  const ids = await getBaselineIds();
  seedCounter += 1;
  const batch = seedCounter;
  const [order] = await db.insert(orders).values({
    orderCode: `CARD-RATING-${batch}`,
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

  for (const [index, rating] of ratings.entries()) {
    const [customer] = await db.insert(customers).values({
      name: `Card Rating Customer ${batch}-${index}`,
      email: `card-rating-${batch}-${index}@capella.test`,
      passwordHash: "x"
    }).$returningId();
    await db.insert(reviews).values({
      customerId: customer.id,
      orderItemId: orderItem.id,
      entityType,
      entityId,
      rating,
      comment: "Seeded rating comment",
      status: "active"
    });
  }
}

test("storefront product list gives every card a rating", async () => {
  const ids = await getBaselineIds();
  await seedVisibleReviews("product", ids.productOneId, [5, 4]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/products");
    const rated = response.json.items.find((item: any) => item.id === ids.productOneId);
    const unrated = response.json.items.find((item: any) => item.id === ids.productTwoId);

    assert.deepEqual(rated.rating, { average: 4.5, count: 2 });
    // An unreviewed card still gets the field, so the grid never has to guess.
    assert.deepEqual(unrated.rating, { average: 0, count: 0 });
  });
});

test("storefront offer list gives every card a rating", async () => {
  const ids = await getBaselineIds();
  await seedVisibleReviews("offer", ids.offerId, [3, 4, 5]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/offers");
    const offer = response.json.items.find((item: any) => item.id === ids.offerId);

    assert.deepEqual(offer.rating, { average: 4, count: 3 });
  });
});

test("storefront collection list gives every card a rating", async () => {
  const ids = await getBaselineIds();
  await seedVisibleReviews("collection", ids.collectionId, [2]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/collections");
    const collection = response.json.items.find((item: any) => item.id === ids.collectionId);

    assert.deepEqual(collection.rating, { average: 2, count: 1 });
  });
});

test("storefront detail payloads carry the same rating their card would show", async () => {
  const ids = await getBaselineIds();
  await seedVisibleReviews("product", ids.productOneId, [5, 4]);
  await seedVisibleReviews("offer", ids.offerId, [3]);

  await withTestServer(app, async (request) => {
    const product = await request("/api/v1/products/test-product-baseline-1");
    const offer = await request("/api/v1/offers/test-offer-baseline");
    const collection = await request("/api/v1/collections/test-collection-baseline");

    assert.deepEqual(product.json.rating, { average: 4.5, count: 2 });
    assert.deepEqual(offer.json.rating, { average: 3, count: 1 });
    assert.deepEqual(collection.json.rating, { average: 0, count: 0 });
  });
});

test("related item cards carry the rating of the entity they link to", async () => {
  const ids = await getBaselineIds();
  await setRelatedLinksForSourceRepo({ type: "product", id: ids.productOneId }, [
    { type: "product", id: ids.productTwoId },
    { type: "offer", id: ids.offerId },
    { type: "collection", id: ids.collectionId }
  ]);
  await seedVisibleReviews("product", ids.productTwoId, [4, 5]);
  await seedVisibleReviews("offer", ids.offerId, [1]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/products/test-product-baseline-1");
    const cards: any[] = response.json.relatedItems;
    const relatedProduct = cards.find((card) => card.type === "product");
    const relatedOffer = cards.find((card) => card.type === "offer");
    const relatedCollection = cards.find((card) => card.type === "collection");

    assert.deepEqual(relatedProduct.rating, { average: 4.5, count: 2 });
    assert.deepEqual(relatedOffer.rating, { average: 1, count: 1 });
    assert.deepEqual(relatedCollection.rating, { average: 0, count: 0 });
  });
});
