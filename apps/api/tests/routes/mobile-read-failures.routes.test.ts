import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { app } from "../../src/app.js";
import { mysqlPool } from "@capella/database/src/db";

test("all mobile cart/wishlist/content routes return safe 500 responses when the database rejects", async t => {
  t.mock.method(mysqlPool, "query", async () => { throw new Error("test database failure with private details"); });
  t.mock.method(mysqlPool, "execute", async () => { throw new Error("test database failure with private details"); });
  const token = jwt.sign({ sub: 1, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    for (const [method, path, body] of [
      ["GET", "/cart", undefined], ["PUT", "/cart", { lines: [] }],
      ["GET", "/wishlist", undefined], ["POST", "/wishlist", { entityType: "product", entityId: 1 }],
      ["DELETE", "/wishlist/product/1", undefined], ["GET", "/advices", undefined], ["GET", "/shop-media-sections", undefined]
    ] as const) {
      const result = await new Promise<{ status: number; json: unknown }>((resolve, reject) => {
        const request = httpRequest(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1${path}`, {
          method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", connection: "close" }
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
      assert.equal(result.status, 500, path);
      assert.deepEqual(result.json, { error: "Internal server error" });
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
