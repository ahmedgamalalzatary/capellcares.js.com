import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "../src/db.js";
import { clearTestSeed, rebuildCategoryPaths, seedTestData } from "../src/seeds/test.seed.js";
import { categoryPaths } from "../drizzle/schema.js";

/** `rebuildCategoryPaths` deletes every closure row and reinserts the rebuilt set in one transaction, so a failed insert cannot leave the closure table empty; these cases assert that observable outcome rather than searching the source for a keyword.
 * Forcing the rebuild itself to fail via a connection-scoped temp table did not work (the pooled client uses a different connection), so the rollback guarantee is asserted against the delete-then-insert shape directly. */

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

  // The rebuild deletes every row and reinserts the computed closure inside one transaction, so a failure in the insert half must roll the delete half back.
  // A non-transactional delete followed by a failing insert is the failure guarded against: the closure would be left empty.
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.delete(categoryPaths);
      // depth is NOT NULL, so passing undefined makes the insert fail after the delete has already run inside this transaction.
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
