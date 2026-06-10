import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

import { errorMiddleware } from "../../src/middlewares/error.middleware.js";

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
    assert.deepEqual(JSON.parse(text), { error: "boom" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
