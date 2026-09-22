import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";

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

test("erp payment-status route reports a Paymob-managed status as a conflict, not a server error", async () => {
  const [order] = await db.insert(orders).values({
    orderCode: "PAYM-0001",
    customerType: "guest",
    fullName: "Paymob Customer",
    phone: "01012345678",
    email: "paymob-managed@example.com",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 1",
    buildingApartment: "1",
    paymentMethod: "paymob",
    paymentStatus: "accepted",
    providerPaymentStatus: "succeeded",
    totalAmount: "35.00"
  }).$returningId();

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/orders/${order!.id}/payment-status`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "pending" })
    });

    assert.equal(response.status, 409);
    assert.equal(response.json.message, "Payment status is managed by Paymob");
  });
});
