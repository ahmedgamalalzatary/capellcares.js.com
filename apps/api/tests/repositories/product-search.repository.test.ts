import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { findVisibleProductBySlug, findVisibleProducts } from "../../src/repositories/product.repository.js";
import { categories } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import { eq, sql } from "drizzle-orm";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

// Regression: the `q` filter used `LIKE ... ESCAPE '\\'`, which renders as the
// invalid MySQL fragment `ESCAPE '\'` and threw ER_PARSE_ERROR, crashing the API
// on every search. Any non-empty `q` must execute and return matches instead.
test("findVisibleProducts matches the English name via q", async () => {
  const rows = await findVisibleProducts({ lang: "en", q: "Baseline" });
  const names = rows.map((row) => row.enName).sort();
  assert.deepEqual(names, ["Baseline Product 1", "Baseline Product 2"]);
});

test("findVisibleProducts matches the Arabic name via q", async () => {
  const rows = await findVisibleProducts({ lang: "ar", q: "تجريبي" });
  assert.equal(rows.length, 2);
});

test("findVisibleProducts matches the keywords column via q", async () => {
  // Seed keywords are "test,baseline"; "test" is not in either localized name,
  // so a hit proves the keywords branch of the OR is searched.
  const rows = await findVisibleProducts({ lang: "en", q: "test" });
  assert.equal(rows.length, 2);
});

test("findVisibleProducts does not throw on LIKE wildcard / escape characters", async () => {
  // Exercises escapeLikeTerm + the LIKE path with chars that must be escaped.
  await assert.doesNotReject(() => findVisibleProducts({ lang: "en", q: "100%_\\" }));
});

test("findVisibleProducts returns empty for a non-matching q", async () => {
  const rows = await findVisibleProducts({ lang: "en", q: "no-such-product-xyz" });
  assert.equal(rows.length, 0);
});

test("findVisibleProducts excludes products whose category is deleted", async () => {
  const { leafCategoryId } = await getBaselineIds();
  await db.update(categories).set({ deletedAt: sql`NOW()` }).where(eq(categories.id, leafCategoryId));

  const rows = await findVisibleProducts({ lang: "en" });

  assert.equal(rows.length, 0);
});

test("findVisibleProductBySlug excludes a product whose category is deleted", async () => {
  const { leafCategoryId } = await getBaselineIds();
  await db.update(categories).set({ deletedAt: sql`NOW()` }).where(eq(categories.id, leafCategoryId));

  const product = await findVisibleProductBySlug("test-product-baseline-1");

  assert.equal(product, null);
});
