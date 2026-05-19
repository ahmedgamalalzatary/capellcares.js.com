import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { db } from "@capella/database/src/db";
import { orders } from "@capella/database/drizzle/schema";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function issueCustomerToken(customerId: number) {
  return jwt.sign({ sub: customerId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("erp orders list returns created orders for admins", async () => {
  const ids = await getBaselineIds();

  const [created] = await db.insert(orders).values({
    orderCode: "ABCD-999",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "150.00"
  }).$returningId();

  await withTestServer(app, async (request) => {
    const response = await request("/api/erp/orders", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(response.status, 200);
    const order = response.json.items.find((item: any) => item.id === created.id);
    assert.ok(order, "expected created order to be listed");
    assert.equal(order.orderCode, "ABCD-999");
    assert.equal(order.paymentStatus, "pending");
  });
});

test("erp order detail returns line items for admins", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const checkout = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Detail Order",
        phone: "01012345678",
        email: "detail-order@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        customerId: ids.customerId,
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
      })
    });

    assert.equal(checkout.status, 201);

    const response = await request(`/api/erp/orders/${checkout.json.id}`, {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.id, checkout.json.id);
    assert.equal(response.json.items.length, 1);
    assert.equal(response.json.items[0].qty, 2);
  });
});

test("erp orders can update payment status", async () => {
  const ids = await getBaselineIds();

  const [created] = await db.insert(orders).values({
    orderCode: "ABCD-998",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "150.00"
  }).$returningId();

  await withTestServer(app, async (request) => {
    const response = await request(`/api/erp/orders/${created.id}/payment-status`, {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "accepted" })
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.ok, true);
  });

  const [updated] = await db
    .select({ paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(eq(orders.id, created.id))
    .limit(1);

  assert.equal(updated?.paymentStatus, "accepted");
});

test("storefront orders list only returns the authenticated customer's orders", async () => {
  const ids = await getBaselineIds();
  const otherCustomerId = ids.customerId + 999;

  await db.insert(orders).values([
    {
      orderCode: "CUST-001",
      customerType: "registered",
      customerId: ids.customerId,
      fullName: "Seed Customer",
      phone: "01012345678",
      email: "seed-customer@capella.test",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street 10",
      buildingApartment: "Building 4",
      notes: "",
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: "150.00"
    },
    {
      orderCode: "CUST-002",
      customerType: "registered",
      customerId: otherCustomerId,
      fullName: "Other Customer",
      phone: "01000000000",
      email: "other@capella.test",
      governorate: "Giza",
      cityArea: "Dokki",
      addressLine: "Street 11",
      buildingApartment: "Building 5",
      notes: "",
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: "200.00"
    }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/orders", {
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.items.length, 1);
    assert.equal(response.json.items[0].orderCode, "CUST-001");
  });
});

test("storefront order detail rejects access to another customer's order", async () => {
  const ids = await getBaselineIds();

  const [created] = await db.insert(orders).values({
    orderCode: "LOCK-001",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "150.00"
  }).$returningId();

  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/orders/${created.id}`, {
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId + 999)}`
      }
    });

    assert.equal(response.status, 404);
  });
});

test("order routes reject invalid ids and invalid payment statuses", async () => {
  const ids = await getBaselineIds();

  const [created] = await db.insert(orders).values({
    orderCode: "ABCD-997",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Seed Customer",
    phone: "01012345678",
    email: "seed-customer@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 10",
    buildingApartment: "Building 4",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "150.00"
  }).$returningId();

  await withTestServer(app, async (request) => {
    const badAdminDetail = await request("/api/erp/orders/not-a-number", {
      headers: { "x-admin-basic": "admin@capella.eg:admin1234" }
    });
    assert.equal(badAdminDetail.status, 400);
    assert.equal(badAdminDetail.json.message, "Invalid order id");

    const badPaymentStatus = await request(`/api/erp/orders/${created.id}/payment-status`, {
      method: "POST",
      headers: {
        "x-admin-basic": "admin@capella.eg:admin1234",
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "paid" })
    });
    assert.equal(badPaymentStatus.status, 400);
    assert.equal(badPaymentStatus.json.message, "Invalid payment status");

    const badCustomerDetail = await request("/api/v1/orders/not-a-number", {
      headers: {
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`
      }
    });
    assert.equal(badCustomerDetail.status, 400);
    assert.equal(badCustomerDetail.json.message, "Invalid order id");
  });
});
