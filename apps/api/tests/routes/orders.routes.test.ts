import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { db } from "@capella/database/src/db";
import { checkoutSessions, customers, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";

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
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/orders", {
      headers: { ...authHeaders }
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
    const authHeaders = await getAdminAuthHeaders(request);
    const checkout = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "erp-order-detail-test" },
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
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.id, checkout.json.id);
    assert.equal(response.json.items.length, 1);
    assert.equal(response.json.items[0].qty, 2);
  });
});

test("erp order detail includes only safe details from its linked payment attempt", async () => {
  const ids = await getBaselineIds();
  const contact = { customerType: "registered" as const, customerId: ids.customerId,
    fullName: "Payment Customer", phone: "01012345678", email: "checkout-email@capella.test",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 10",
    buildingApartment: "Floor 3, apartment 12", notes: "Call first" };
  const [session] = await db.insert(checkoutSessions).values({ ...contact,
    publicId: "checkout_admin_detail", idempotencyKey: "admin-detail", cartSnapshot: "[]",
    amountCents: 15000, state: "completed", attemptCount: 2,
    reservationExpiresAt: new Date("2026-09-21T10:00:00.000Z") }).$returningId();
  const [attempt] = await db.insert(paymentAttempts).values({ checkoutSessionId: session.id,
    attemptNumber: 1, merchantReference: "capella_admin_detail", amountCents: 15000,
    environment: "test", status: "succeeded", paymentMethod: "card", integrationId: 5885253,
    paymobOrderId: "987654", paymobTransactionId: "123456789", clientSecret: "must-never-reach-erp",
    createdAt: new Date("2026-09-21T09:00:00.000Z") }).$returningId();
  await db.insert(paymentAttempts).values({ checkoutSessionId: session.id, attemptNumber: 2,
    merchantReference: "capella_other_attempt", amountCents: 15000, environment: "test", status: "failed" });
  const [created] = await db.insert(orders).values({ ...contact, orderCode: "PAYM-001",
    paymentMethod: "paymob", paymentStatus: "pending", providerPaymentStatus: "partially_refunded",
    refundedAmountCents: 5025, paymentAttemptId: attempt.id, totalAmount: "150.00" }).$returningId();

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/orders/${created.id}`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.json.email, contact.email);
    assert.equal(response.json.buildingApartment, contact.buildingApartment);
    assert.equal(response.json.notes, "Call first");
    assert.equal(response.json.refundedAmountCents, 5025);
    assert.deepEqual(response.json.payment, {
      attemptNumber: 1, merchantReference: "capella_admin_detail", environment: "test",
      paymentMethod: "card", integrationId: 5885253, paymobOrderId: "987654",
      paymobTransactionId: "123456789", createdAt: "2026-09-21T09:00:00.000Z"
    });
    assert.ok(!JSON.stringify(response.json).includes("must-never-reach-erp"));

    const customerResponse = await request(`/api/v1/orders/${created.id}`, {
      headers: { authorization: `Bearer ${issueCustomerToken(ids.customerId)}` }
    });
    assert.equal(customerResponse.status, 200);
    assert.equal(customerResponse.json.payment, undefined);
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
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/orders/${created.id}/payment-status`, {
      method: "POST",
      headers: {
        ...authHeaders,
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

test("erp denied orders restore stock and reject further payment-status changes", async () => {
  const ids = await getBaselineIds();
  const [before] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId))
    .limit(1);

  let createdOrderId = 0;

  await withTestServer(app, async (request) => {
    const checkout = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "erp-denied-order-test" },
      body: JSON.stringify({
        fullName: "Denied Order",
        phone: "01012345678",
        email: "denied-order@capella.test",
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
    createdOrderId = checkout.json.id;

    const authHeaders = await getAdminAuthHeaders(request);
    const denyResponse = await request(`/api/erp/orders/${createdOrderId}/payment-status`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "denied" })
    });

    assert.equal(denyResponse.status, 200);

    const lockedResponse = await request(`/api/erp/orders/${createdOrderId}/payment-status`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json"
      },
      body: JSON.stringify({ paymentStatus: "accepted" })
    });

    assert.equal(lockedResponse.status, 409);
    assert.equal(lockedResponse.json.message, "Denied orders are locked");
  });

  const [after] = await db
    .select({ paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(eq(orders.id, createdOrderId))
    .limit(1);
  assert.equal(after?.paymentStatus, "denied");

  const [restocked] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId))
    .limit(1);
  assert.equal(restocked?.stockQty, before?.stockQty);
});

test("storefront orders list only returns the authenticated customer's orders", async () => {
  const ids = await getBaselineIds();
  const [otherCustomer] = await db.insert(customers).values({
    name: "Other Customer",
    email: "other@capella.test",
    passwordHash: "$2a$10$0V6QY0bL5Qn5hEw5N1iXROXGdPvxI6Bjq5lHppZArYrusS4x2QVFG"
  }).$returningId();

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
      customerId: otherCustomer.id,
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
  const [otherCustomer] = await db.insert(customers).values({
    name: "Other Customer",
    email: "other-order@capella.test",
    passwordHash: "$2a$10$0V6QY0bL5Qn5hEw5N1iXROXGdPvxI6Bjq5lHppZArYrusS4x2QVFG"
  }).$returningId();

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
        authorization: `Bearer ${issueCustomerToken(otherCustomer.id)}`
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
    const authHeaders = await getAdminAuthHeaders(request);
    const badAdminDetail = await request("/api/erp/orders/not-a-number", {
      headers: { ...authHeaders }
    });
    assert.equal(badAdminDetail.status, 400);
    assert.equal(badAdminDetail.json.message, "Invalid order id");

    const badPaymentStatus = await request(`/api/erp/orders/${created.id}/payment-status`, {
      method: "POST",
      headers: {
        ...authHeaders,
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
