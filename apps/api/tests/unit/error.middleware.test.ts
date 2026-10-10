import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

import { errorMiddleware } from "../../src/middlewares/error.middleware.js";
import { withTestServer } from "../helpers/request.js";

test("errorMiddleware handles forwarded errors as JSON 500 responses", async () => {
  const app = express();
  app.get("/boom", (_req, _res, next) => {
    next(new Error("boom"));
  });
  app.use(errorMiddleware);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/boom`);
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.match(response.headers.get("content-type") ?? "", /application\/json/i);
    assert.deepEqual(JSON.parse(text), { error: "Internal server error" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("errorMiddleware logs the real error message and stack outside tests without leaking them to the client", async () => {
  const app = express();
  app.get("/boom", (_req, _res, next) => {
    next(new Error("Duplicate entry 'pro' for key 'products.products_slug_unique'"));
  });
  app.use(errorMiddleware);

  const logged: unknown[][] = [];
  const originalConsoleError = console.error;
  const originalNodeEnv = process.env.NODE_ENV;
  console.error = (...args: unknown[]) => { logged.push(args); };
  process.env.NODE_ENV = "production";

  try {
    const response = await withTestServer(app, (request) => request("/boom?token=secret"));

    const output = logged.flat().map((value) => (value instanceof Error ? value.stack ?? value.message : String(value))).join("\n");
    assert.match(output, /GET \/boom/);
    assert.doesNotMatch(output, /token=secret/);
    assert.match(output, /Duplicate entry 'pro' for key 'products\.products_slug_unique'/);
    assert.match(output, /error\.middleware\.test\.ts/);
    assert.equal(response.status, 500);
    assert.deepEqual(response.json, { error: "Internal server error" });
  } finally {
    console.error = originalConsoleError;
    process.env.NODE_ENV = originalNodeEnv;
  }
});
