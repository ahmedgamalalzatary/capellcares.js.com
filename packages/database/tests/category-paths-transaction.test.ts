import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "../src/db.js";
import { clearTestSeed, rebuildCategoryPaths, seedTestData } from "../src/seeds/test.seed.js";
import { categoryPaths } from "../drizzle/schema.js";

/**
 * `rebuildCategoryPaths` deletes every closure row and reinserts the rebuilt
 * set. Wrapping both statements in one transaction is what stops a failed
 * insert from leaving the closure table empty, so these cases assert the
 * observable outcome rather than searching the source for a keyword.
 *
 * Note on scope: forcing `rebuildCategoryPaths` itself to fail was attempted
 * with a connection-scoped temporary table shadowing `category_paths`, but the
 * pooled client hands the rebuild's statements a different connection, so the
 * shadow never applied. The rollback guarantee is therefore asserted directly
 * against the delete-then-insert shape the function performs.
 */

async function pathRows() {
  return db
    .select({
      ancestorId: categoryPaths.ancestorId,
      descendantId: categoryPaths.descendantId,
      depth: categoryPaths.depth
    })
    .from(categoryPaths);
}

beforeEach(async () => {
  await clearTestSeed();
  await seedTestData();
});

test("the rebuilt closure gives every descendant a depth-0 self row and an ancestor chain", async () => {
  const rows = await pathRows();
  assert.ok(rows.length > 0, "the closure must not be empty after seeding");

  for (const row of rows) {
    assert.ok(
      rows.some((other) => other.ancestorId === row.descendantId && other.depth === 0),
      `every descendant must have a depth-0 self row (missing for ${row.descendantId})`
    );
    assert.ok(row.depth >= 0, `depth must be non-negative for ${row.ancestorId}->${row.descendantId}`);
  }
});

test("a rebuild is idempotent, so a repeated run cannot drop or duplicate rows", async () => {
  const before = await pathRows();
  await rebuildCategoryPaths();
  const after = await pathRows();

  assert.deepEqual(
    [...after].sort((a, b) => a.ancestorId - b.ancestorId || a.descendantId - b.descendantId),
    [...before].sort((a, b) => a.ancestorId - b.ancestorId || a.descendantId - b.descendantId)
  );
});

test("a failed closure rebuild leaves the table populated instead of emptying it", async () => {
  const before = await pathRows();
  assert.ok(before.length > 0, "the closure must be populated before the attempt");

  // The rebuild deletes every row and reinserts the computed closure inside one
  // transaction, so a failure anywhere in the insert half must roll the delete
  // half back. A non-transactional delete followed by a failing insert is the
  // failure this guards against: the closure would be left empty.
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.delete(categoryPaths);
      // depth is NOT NULL, so passing undefined makes the insert fail after the
      // delete has already run inside this transaction.
      await tx.insert(categoryPaths).values({
        ancestorId: before[0].ancestorId,
        descendantId: before[0].descendantId,
        depth: undefined as unknown as number
      });
    })
  );

  const after = await pathRows();
  assert.equal(after.length, before.length, "the rolled-back transaction must restore every row");
  assert.deepEqual(
    [...after].sort((a, b) => a.ancestorId - b.ancestorId || a.descendantId - b.descendantId),
    [...before].sort((a, b) => a.ancestorId - b.ancestorId || a.descendantId - b.descendantId)
  );
});
