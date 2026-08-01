import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/mysql-core";

import { reviews } from "../drizzle/schema.js";

test("review schema declares database checks for rating and trimmed comment length", () => {
  const checkNames = getTableConfig(reviews).checks.map((constraint) => constraint.name).sort();

  assert.deepEqual(checkNames, ["reviews_comment_length_check", "reviews_rating_check"]);
});

test("review prompt order migration resolves duplicate customer orders before adding uniqueness", async () => {
  const migration = await readFile(new URL("../drizzle/migrations/0025_review_prompt_orders.sql", import.meta.url), "utf8");
  const duplicateResolution = migration.indexOf("DELETE duplicate_prompt");
  const uniqueConstraint = migration.indexOf("review_prompt_states_customer_order_unique");

  assert.ok(duplicateResolution >= 0, "migration must resolve duplicate customer/order prompt rows");
  assert.ok(duplicateResolution < uniqueConstraint, "duplicate resolution must run before the unique constraint");
});
