import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { app } from "../../src/app.js";
import { mysqlPool } from "@capella/database/src/db";
import { ensureBootstrapAdmin } from "../../src/modules/admin/auth/admin-auth.service.js";

const DB_FAILURE = "test database failure with private details";

function send(server: Server, method: string, path: string, headers: Record<string, string>, body?: unknown) {
  return new Promise<{ status: number; json: any }>((resolve, reject) => {
    const request = httpRequest(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      method, headers: { ...headers, "content-type": "application/json", connection: "close" }
    }, response => {
      let text = "";
      response.on("data", chunk => { text += String(chunk); });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, json: JSON.parse(text) }));
    });
    request.setTimeout(1500, () => request.destroy(new Error(`Route did not settle: ${path}`)));
    request.on("error", reject);
    if (body !== undefined) request.write(JSON.stringify(body));
    request.end();
  });
}

async function withServer(run: (server: Server) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    await run(server);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test("async cart/wishlist/content routes return safe 500 responses when the database rejects", async t => {
  t.mock.method(mysqlPool, "query", async () => { throw new Error(DB_FAILURE); });
  t.mock.method(mysqlPool, "execute", async () => { throw new Error(DB_FAILURE); });
  const token = jwt.sign({ sub: 1, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret");
  await withServer(async server => {
    for (const [method, path, body] of [
      ["GET", "/cart", undefined], ["PUT", "/cart", { lines: [] }],
      ["GET", "/wishlist", undefined], ["POST", "/wishlist", { entityType: "product", entityId: 1 }],
      ["DELETE", "/wishlist/product/1", undefined], ["GET", "/advices", undefined], ["GET", "/shop-media-sections", undefined]
    ] as const) {
      const result = await send(server, method, `/api/v1${path}`, { authorization: `Bearer ${token}` }, body);
      assert.equal(result.status, 500, path);
      assert.deepEqual(result.json, { error: "Internal server error" });
    }
  });
});

test("async ERP advice and shop-media routes return safe 500 responses when the database rejects", async t => {
  process.env.ADMIN_EMAIL = "async-failures-admin@capella.test";
  process.env.ADMIN_PASSWORD = "AdminPass123";
  await ensureBootstrapAdmin();

  await withServer(async server => {
    const login = await send(server, "POST", "/api/erp/auth/login", {}, {
      email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD
    });
    assert.equal(login.status, 200);
    const headers = { authorization: `Bearer ${login.json.accessToken}` };

    // Let the admin-auth lookup reach the real database, then fail every query (and transaction connection) the route handler itself makes.
    let passThrough = 0;
    for (const method of ["query", "execute", "getConnection"] as const) {
      const original = mysqlPool[method].bind(mysqlPool) as (...args: unknown[]) => unknown;
      t.mock.method(mysqlPool, method, async (...args: unknown[]) => {
        if (passThrough > 0) {
          passThrough -= 1;
          return original(...args);
        }
        throw new Error(DB_FAILURE);
      });
    }

    for (const [method, path, body] of [
      ["GET", "/advices", undefined],
      ["POST", "/advices", { title: { ar: "نصيحة", en: "Advice" }, description: { ar: "وصف", en: "Text" }, videoUrl: "https://www.youtube.com/watch?v=capella", status: "active" }],
      ["POST", "/advices/1/toggle-status", undefined],
      ["DELETE", "/advices/1", undefined],
      ["GET", "/shop-media-sections", undefined],
      ["POST", "/shop-media-sections/1", { status: "active", items: [] }]
    ] as const) {
      passThrough = 1;
      const result = await send(server, method, `/api/erp${path}`, headers, body);
      assert.equal(result.status, 500, `${method} ${path}`);
      assert.deepEqual(result.json, { error: "Internal server error" });
    }
  });
});
