import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("rebuildCategoryPaths wraps delete and insert in a transaction", async () => {
  const source = await readFile(new URL("../src/seeds/test.seed.ts", import.meta.url), "utf8");

  assert.match(source, /await db\.transaction\(async \(tx\) => \{/);
  assert.match(source, /await tx\.delete\(categoryPaths\);/);
  assert.match(source, /await tx\.insert\(categoryPaths\)\.values\(pathRows\);/);
});
