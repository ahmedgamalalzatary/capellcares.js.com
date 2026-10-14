import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PAGE_SIZE, isPageSize, MAX_VISIBLE_ROWS, maxPagesPerRequest, PAGE_SIZES, pageMeta, totalPagesOf } from "../src/pagination.js";

test("page sizes are 20, 50 and 100 with 20 as the default and 100 visible rows at most", () => {
  assert.deepEqual(PAGE_SIZES, [20, 50, 100]);
  assert.equal(DEFAULT_PAGE_SIZE, 20);
  assert.equal(MAX_VISIBLE_ROWS, 100);
});

test("isPageSize accepts only the offered sizes", () => {
  assert.equal(isPageSize(50), true);
  assert.equal(isPageSize(30), false);
  assert.equal(isPageSize("20"), false);
});

test("totalPagesOf rounds up and is zero for an empty list", () => {
  assert.equal(totalPagesOf(0, 20), 0);
  assert.equal(totalPagesOf(1, 20), 1);
  assert.equal(totalPagesOf(40, 20), 2);
  assert.equal(totalPagesOf(41, 20), 3);
});

test("maxPagesPerRequest keeps one request within the visible-row limit", () => {
  assert.equal(maxPagesPerRequest(20), 5);
  assert.equal(maxPagesPerRequest(50), 2);
  assert.equal(maxPagesPerRequest(100), 1);
});

test("pageMeta describes the requested page", () => {
  assert.deepEqual(pageMeta(134, 2, 20), { page: 2, pageSize: 20, total: 134, totalPages: 7 });
});
