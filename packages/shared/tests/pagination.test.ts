import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_SIZE, pageMeta, totalPagesOf } from "../src/pagination.js";

test("every paginated list shows 20 rows per page", () => {
  assert.equal(PAGE_SIZE, 20);
});

test("totalPagesOf rounds up and is zero for an empty list", () => {
  assert.equal(totalPagesOf(0), 0);
  assert.equal(totalPagesOf(1), 1);
  assert.equal(totalPagesOf(40), 2);
  assert.equal(totalPagesOf(41), 3);
  assert.equal(totalPagesOf(3, 1), 3);
});

test("pageMeta describes the requested page", () => {
  assert.deepEqual(pageMeta(134, 2), { page: 2, pageSize: 20, total: 134, totalPages: 7 });
});
