import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { likeContains, pagedQuerySchema, pageWindow } from "../../src/lib/pagination.js";

const schema = pagedQuerySchema(["date", "total"], { status: z.enum(["active", "inactive"]).optional() });

test("pagedQuerySchema fills defaults", () => {
  assert.deepEqual(schema.parse({}), { page: 1, dir: "asc" });
});

test("pagedQuerySchema reads every param from the query string", () => {
  assert.deepEqual(
    schema.parse({ page: "3", q: "  rose ", sort: "date", dir: "desc", status: "active" }),
    { page: 3, q: "rose", sort: "date", dir: "desc", status: "active" }
  );
});

test("pagedQuerySchema treats a blank search as no search", () => {
  assert.equal(schema.parse({ q: "   " }).q, undefined);
});

test("pagedQuerySchema rejects invalid params, including page size and load-more spans", () => {
  for (const query of [
    { page: "0" },
    { page: "1.5" },
    { pageSize: "20" },
    { pages: "2" },
    { sort: "price" },
    { dir: "up" },
    { status: "gone" },
    { unknown: "x" },
    { q: ["a", "b"] },
    { q: "x".repeat(101) }
  ]) {
    assert.equal(schema.safeParse(query).success, false, JSON.stringify(query));
  }
});

test("pageWindow turns a page into limit and offset (20 rows by default)", () => {
  assert.deepEqual(pageWindow(3), { limit: 20, offset: 40 });
  assert.deepEqual(pageWindow(3, 1), { limit: 1, offset: 2 });
});

test("likeContains escapes LIKE wildcards", () => {
  assert.equal(likeContains("50%_off\\"), "%50\\%\\_off\\\\%");
});
