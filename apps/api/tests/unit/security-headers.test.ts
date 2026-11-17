import assert from "node:assert/strict";
import test from "node:test";
import express from "express";

import { securityHeadersMiddleware } from "../../src/middlewares/security-headers.middleware.js";
import { withTestServer } from "../helpers/request.js";

test("securityHeadersMiddleware sets hardening headers on every response", async () => {
  const app = express();
  app.use(securityHeadersMiddleware);
  app.get("/ping", (_req, res) => res.json({ ok: true }));

  await withTestServer(app, async (request) => {
    const response = await request("/ping");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  });
});
