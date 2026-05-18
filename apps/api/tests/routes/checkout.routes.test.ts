import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("checkout route allows guest checkout when the email already exists", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Existing Guest",
        phone: "01012345678",
        email: "seed-customer@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);
    assert.ok(response.json.id);
  });
});

test("checkout route returns a pending COD payment status for a created order", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Pending COD",
        phone: "01012345678",
        email: "pending-cod@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);
    assert.equal(response.json.paymentStatus, "pending");
    assert.match(response.json.orderCode, /^[A-Z]{4}-\d{3,}$/);

    const [order] = await db
      .select({ paymentStatus: orders.paymentStatus, orderCode: orders.orderCode })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.paymentStatus, "pending");
    assert.equal(order?.orderCode, response.json.orderCode);
  });
});
