import assert from "node:assert/strict";
import test from "node:test";
import { mysqlPool } from "@capella/database/src/db";
import { app } from "../../src/app.js";
import { withTestServer } from "../helpers/request.js";

test("health becomes unavailable when the database cannot answer", async (t) => {
  t.mock.method(mysqlPool, "query", async () => { throw new Error("Database unavailable"); });
  await withTestServer(app, async (request) => {
    const response = await request("/health");
    assert.equal(response.status, 503);
    assert.deepEqual(response.json, { ok: false });
  });
});

test("health checks the database before reporting readiness", async (t) => {
  const query = t.mock.method(mysqlPool, "query", async () => [[], []]);
  await withTestServer(app, async (request) => {
    const response = await request("/health");
    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { ok: true });
    assert.deepEqual(query.mock.calls[0]?.arguments[0], { sql: "SELECT 1", timeout: 3000 });
  });
});
