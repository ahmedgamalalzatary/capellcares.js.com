import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "../src/db.js";
import { clearTestSeed, seedTestData } from "../src/seeds/test.seed.js";
import { categories, collections, offers } from "../drizzle/schema.js";

const ROOT_ONLY = "must be classified under a root category";

beforeEach(async () => {
  await clearTestSeed();
  await seedTestData();
});

async function rootParentIdFor(table: typeof collections | typeof offers, id: number) {
  const row = await db
    .select({ parentId: categories.parentId })
    .from(table)
    .innerJoin(categories, eq(table.categoryId, categories.id))
    .where(eq(table.id, id))
    .limit(1);

  assert.ok(row[0], "seeded row and its category must exist");
  return row[0].parentId;
}

test("the seeded offer is classified under a root category", async () => {
  const [offer] = await db.select({ id: offers.id }).from(offers).where(eq(offers.slug, "test-offer-baseline"));
  assert.ok(offer, "baseline offer must be seeded");

  assert.equal(await rootParentIdFor(offers, offer.id), null, `seeded offer ${ROOT_ONLY}`);
});

test("the seeded collection is classified under a root category", async () => {
  const [collection] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.slug, "test-collection-baseline"));
  assert.ok(collection, "baseline collection must be seeded");

  assert.equal(await rootParentIdFor(collections, collection.id), null, `seeded collection ${ROOT_ONLY}`);
});
