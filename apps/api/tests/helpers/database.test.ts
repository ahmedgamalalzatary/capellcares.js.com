import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import { categories, products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { getBaselineIds, resetApiTestDatabase } from "./database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("getBaselineIds resolves the top-most root category for deeply nested product categories", async () => {
  const baseline = await getBaselineIds();

  const [intermediateCategory] = await db
    .insert(categories)
    .values({
      slug: `baseline-mid-${Date.now()}`,
      arName: "قسم وسيط",
      enName: "Intermediate Category",
      parentId: baseline.rootCategoryId,
      isLeaf: false
    })
    .$returningId();

  const [deepLeafCategory] = await db
    .insert(categories)
    .values({
      slug: `baseline-deep-leaf-${Date.now()}`,
      arName: "قسم نهائي",
      enName: "Deep Leaf Category",
      parentId: intermediateCategory.id,
      isLeaf: true
    })
    .$returningId();

  await db
    .update(products)
    .set({ categoryId: deepLeafCategory.id })
    .where(eq(products.id, baseline.productOneId));

  const ids = await getBaselineIds();

  assert.equal(ids.leafCategoryId, deepLeafCategory.id);
  assert.equal(ids.rootCategoryId, baseline.rootCategoryId);
});
