import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../../src/app.js";
import { resolveAllowedOrigins } from "../../src/config/cors.js";
import { withTestServer } from "../helpers/request.js";

test("CORS preflight lets the browser cache the answer for a day so cross-site ERP calls skip repeat OPTIONS", async () => {
  const [origin] = resolveAllowedOrigins();

  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/products", {
      method: "OPTIONS",
      headers: {
        origin: origin!,
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization"
      }
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-max-age"), "86400");
  });
});
