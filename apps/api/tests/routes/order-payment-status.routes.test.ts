import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds } from "../helpers/database.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { shippingWorkItems, productVariants } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { fixtureShippingService, selectedDestination, shippingBuyer } from "../helpers/checkout-shipping.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("erp payment-status route returns 404 when the order does not exist", async () => {
  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/orders/999999/payment-status", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "accepted" })
    });

    assert.equal(response.status, 404);
    assert.equal(response.json.message, "Order not found");
  });
});
