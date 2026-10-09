import assert from "node:assert/strict";
import test from "node:test";
import type { Response } from "express";
import { mysqlPool } from "@capella/database/src/db";
import { requireErpPermission } from "../../src/middlewares/erp-permissions.middleware.js";
import type { ErpAuthenticatedRequest } from "../../src/middlewares/admin-auth.middleware.js";

test("a staff permission lookup that fails forwards the error instead of rejecting unhandled", async t => {
  t.mock.method(mysqlPool, "query", async () => { throw new Error("test database failure"); });
  t.mock.method(mysqlPool, "execute", async () => { throw new Error("test database failure"); });
  const req = { adminUser: { id: 1, role: "staff", email: "staff@capella.test" } } as ErpAuthenticatedRequest;

  const forwarded = await new Promise<unknown>((resolve, reject) => {
    const outcome = requireErpPermission("advices.read")(req, {} as Response, resolve) as unknown;
    void Promise.resolve(outcome).catch(reject);
  });

  assert.ok(forwarded instanceof Error);
});
