import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { collectionItems, collections, offerItems, offers } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

/** Counts the reads a request makes, so per-row query fan-out is visible. */
async function countSelects(run: () => Promise<unknown>) {
  const original = db.select.bind(db);
  let count = 0;
  (db as any).select = (...args: unknown[]) => {
    count += 1;
    return (original as any)(...args);
  };
  try {
    await run();
  } finally {
    delete (db as any).select;
  }
  return count;
}

async function addOffers(howMany: number, variantId: number) {
  for (let index = 0; index < howMany; index += 1) {
    const [created] = await db.insert(offers).values({
      slug: `extra-offer-${index}`,
      arName: `عرض إضافي ${index}`,
      enName: `Extra Offer ${index}`,
      fixedPrice: "20.00",
      status: "active",
      visibility: "visible"
    }).$returningId();
    await db.insert(offerItems).values({ offerId: created.id, variantId, qty: 1 });
  }
}

async function addCollections(howMany: number, variantId: number, categoryId: number) {
  for (let index = 0; index < howMany; index += 1) {
    const [created] = await db.insert(collections).values({
      slug: `extra-collection-${index}`,
      arName: `تجميعة إضافية ${index}`,
      enName: `Extra Collection ${index}`,
      fixedPrice: "20.00",
      categoryId,
      status: "active",
      visibility: "visible"
    }).$returningId();
    await db.insert(collectionItems).values({ collectionId: created.id, variantId, qty: 1 });
  }
}

test("the offers listing reads a fixed number of times however many offers it returns", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const baseline = await countSelects(() => request("/api/v1/offers"));
    await addOffers(3, ids.firstVariantId);
    const withMoreOffers = await countSelects(async () => {
      const response = await request("/api/v1/offers");
      assert.equal(response.json.items.length, 4);
    });

    assert.equal(withMoreOffers, baseline, "each extra offer must not add its own query");
  });
});

test("the collections listing reads a fixed number of times however many collections it returns", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const baseline = await countSelects(() => request("/api/v1/collections"));
    await addCollections(3, ids.firstVariantId, ids.leafCategoryId);
    const withMoreCollections = await countSelects(async () => {
      const response = await request("/api/v1/collections");
      assert.equal(response.json.items.length, 4);
    });

    assert.equal(withMoreCollections, baseline, "each extra collection must not add its own query");
  });
});

test("bundle listings still report each bundle's own stock and original total", async () => {
  const ids = await getBaselineIds();
  await addOffers(1, ids.firstVariantId);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/offers");
    const baseline = response.json.items.find((item: any) => item.id === ids.offerId);
    const extra = response.json.items.find((item: any) => item.slug === "extra-offer-0");

    // Baseline offer holds both variants (35 + 55); the extra holds one (35).
    assert.equal(baseline.originalTotal, 90);
    assert.equal(baseline.stock, 6);
    assert.equal(extra.originalTotal, 35);
    assert.equal(extra.stock, 10);
  });
});
