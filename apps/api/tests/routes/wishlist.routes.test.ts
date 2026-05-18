import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("wishlist routes reject unauthenticated requests", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/wishlist", { method: "GET" });
    assert.equal(response.status, 401);
  });
});

test("wishlist routes add list and remove products for an authenticated customer", async () => {
  const ids = await getBaselineIds();
  const accessToken = jwt.sign(
    { sub: ids.customerId, role: "customer" },
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    { expiresIn: "15m" }
  );

  await withTestServer(app, async (request) => {
    const authHeaders = {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    };

    const addResponse = await request("/api/v1/wishlist", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ productId: ids.productOneId })
    });
    assert.equal(addResponse.status, 200);

    const listResponse = await request("/api/v1/wishlist", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.items.length, 1);
    assert.equal(listResponse.json.items[0].productId, ids.productOneId);

    const removeResponse = await request(`/api/v1/wishlist/${ids.productOneId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(removeResponse.status, 200);

    const emptyListResponse = await request("/api/v1/wishlist", {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    assert.equal(emptyListResponse.json.items.length, 0);
  });
});
