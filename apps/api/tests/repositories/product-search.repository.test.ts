import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { categories, products } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { findVisibleProducts } from "../../src/repositories/product.repository.js";
import { resetApiTestDatabase } from "../helpers/database.js";

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

test("findVisibleProducts includes ancestor products without including sibling branches", async () => {
  const suffix = Date.now();
  const [skinCare] = await db.insert(categories).values({
    slug: `filter-skin-care-${suffix}`,
    arName: "Skin Care",
    enName: "Skin Care",
    isLeaf: false
  }).$returningId();
  const [skinSerum] = await db.insert(categories).values({
    parentId: skinCare.id,
    slug: `filter-skin-serum-${suffix}`,
    arName: "Skin Serum",
    enName: "Skin Serum",
    isLeaf: false
  }).$returningId();
  const [drySkin] = await db.insert(categories).values({
    parentId: skinSerum.id,
    slug: `filter-dry-skin-${suffix}`,
    arName: "Dry Skin",
    enName: "Dry Skin",
    isLeaf: false
  }).$returningId();
  const [veryDrySkin] = await db.insert(categories).values({
    parentId: drySkin.id,
    slug: `filter-very-dry-skin-${suffix}`,
    arName: "Very Dry Skin",
    enName: "Very Dry Skin",
    isLeaf: true
  }).$returningId();
  const [oilySkin] = await db.insert(categories).values({
    parentId: skinSerum.id,
    slug: `filter-oily-skin-${suffix}`,
    arName: "Oily Skin",
    enName: "Oily Skin",
    isLeaf: true
  }).$returningId();

  await db.insert(products).values([
    { sku: `GENERIC-${suffix}`, slug: `generic-serum-${suffix}`, arName: "Generic Serum", enName: "Generic Serum", buyingPrice: "10.00", keywords: "serum", imagePath: "/uploads/test.png", status: "active", categoryId: skinSerum.id },
    { sku: `DRY-${suffix}`, slug: `dry-serum-${suffix}`, arName: "Dry Serum", enName: "Dry Serum", buyingPrice: "10.00", keywords: "serum", imagePath: "/uploads/test.png", status: "active", categoryId: drySkin.id },
    { sku: `VERY-DRY-${suffix}`, slug: `very-dry-serum-${suffix}`, arName: "Very Dry Serum", enName: "Very Dry Serum", buyingPrice: "10.00", keywords: "serum", imagePath: "/uploads/test.png", status: "active", categoryId: veryDrySkin.id },
    { sku: `OILY-${suffix}`, slug: `oily-serum-${suffix}`, arName: "Oily Serum", enName: "Oily Serum", buyingPrice: "10.00", keywords: "serum", imagePath: "/uploads/test.png", status: "active", categoryId: oilySkin.id }
  ]);

  const rows = await findVisibleProducts({ lang: "en", categoryId: String(drySkin.id) });

  assert.deepEqual(
    rows.map((row) => row.enName).sort(),
    ["Dry Serum", "Generic Serum", "Very Dry Serum"]
  );
});
