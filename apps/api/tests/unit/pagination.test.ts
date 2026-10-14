import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { likeContains, pagedQuerySchema, pageWindow } from "../../src/lib/pagination.js";

const schema = pagedQuerySchema(["date", "total"], { status: z.enum(["active", "inactive"]).optional() });

test("pagedQuerySchema fills defaults", () => {
  assert.deepEqual(schema.parse({}), { page: 1, pageSize: 20, pages: 1, dir: "asc" });
});

test("pagedQuerySchema reads every param from the query string", () => {
  assert.deepEqual(
    schema.parse({ page: "3", pageSize: "50", pages: "2", q: "  rose ", sort: "date", dir: "desc", status: "active" }),
    { page: 3, pageSize: 50, pages: 2, q: "rose", sort: "date", dir: "desc", status: "active" }
  );
});

test("pagedQuerySchema treats a blank search as no search", () => {
  assert.equal(schema.parse({ q: "   " }).q, undefined);
});

test("pagedQuerySchema rejects invalid params", () => {
  for (const query of [
    { page: "0" },
    { page: "1.5" },
    { pageSize: "30" },
    { pages: "0" },
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

test("pagedQuerySchema keeps one request within 100 rows", () => {
  assert.equal(schema.safeParse({ pageSize: "20", pages: "5" }).success, true);
  assert.equal(schema.safeParse({ pageSize: "20", pages: "6" }).success, false);
  assert.equal(schema.safeParse({ pageSize: "50", pages: "3" }).success, false);
  assert.equal(schema.safeParse({ pageSize: "100", pages: "2" }).success, false);
});

test("pageWindow turns a page and its loaded-more pages into limit and offset", () => {
  assert.deepEqual(pageWindow({ page: 3, pageSize: 20, pages: 2 }), { limit: 40, offset: 40 });
});

test("likeContains escapes LIKE wildcards", () => {
  assert.equal(likeContains("50%_off\\"), "%50\\%\\_off\\\\%");
});
