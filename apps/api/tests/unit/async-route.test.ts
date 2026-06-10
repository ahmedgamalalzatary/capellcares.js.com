import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";

import { errorMiddleware } from "../../src/middlewares/error.middleware.js";
import { wrapAsync } from "../../src/lib/async-route.js";

test("wrapAsync forwards rejected async route handlers to the JSON error middleware", async () => {
  const app = express();
  app.get(
    "/boom",
    wrapAsync(async () => {
      throw new Error("async boom");
    })
  );
  app.use(errorMiddleware);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/boom`);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "async boom" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
