import assert from "node:assert/strict";
import test from "node:test";

import { buildLineage, collectDescendantIds } from "../../src/repositories/category-tree.js";

// Tree used across the cases:
//   1 (root)
//   ├─ 2
//   │  └─ 4
//   └─ 3
//   5 (separate root)
const rows = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 1 },
  { id: 4, parentId: 2 },
  { id: 5, parentId: null }
];

test("collectDescendantIds includes the root and every descendant", () => {
  assert.deepEqual(collectDescendantIds(1, rows).sort((a, b) => a - b), [1, 2, 3, 4]);
});

test("collectDescendantIds on a mid-tree node returns its subtree only", () => {
  assert.deepEqual(collectDescendantIds(2, rows).sort((a, b) => a - b), [2, 4]);
});

test("collectDescendantIds on a leaf returns just itself", () => {
  assert.deepEqual(collectDescendantIds(4, rows), [4]);
});

test("collectDescendantIds is safe against parent cycles", () => {
  const cyclic = [
    { id: 1, parentId: 2 },
    { id: 2, parentId: 1 }
  ];
  assert.deepEqual(collectDescendantIds(1, cyclic).sort((a, b) => a - b), [1, 2]);
});

test("buildLineage returns ancestors root-first, inclusive of the start node", () => {
  assert.deepEqual(
    buildLineage(4, rows).map((node) => node.id),
    [1, 2, 4]
  );
});

test("buildLineage of a root is just that root", () => {
  assert.deepEqual(
    buildLineage(1, rows).map((node) => node.id),
    [1]
  );
});

test("buildLineage of null is empty", () => {
  assert.deepEqual(buildLineage(null, rows), []);
});

test("buildLineage stops on a broken parent chain instead of looping", () => {
  const orphaned = [{ id: 9, parentId: 99 }];
  assert.deepEqual(
    buildLineage(9, orphaned).map((node) => node.id),
    [9]
  );
});
