import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";

import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { db } from "@capella/database/src/db";
import { checkoutSessions, collectionItems, collections, orders, paymentAttempts } from "@capella/database/drizzle/schema";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-access-secret";

function issueCustomerToken(customerId: number) {
  return jwt.sign({ sub: customerId, role: "customer" }, ACCESS_SECRET, { expiresIn: "15m" });
}

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
    assert.equal(response.json.kind, "cod_order");
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

test("checkout route persists registered customer orders for authenticated customers", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`
      },
      body: JSON.stringify({
        fullName: "Registered Customer",
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

    const [order] = await db
      .select({ customerType: orders.customerType, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.customerType, "registered");
    assert.equal(order?.customerId, ids.customerId);
  });
});

test("checkout route returns 503 without reserving stock when no Paymob integration is confirmed", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify({
        fullName: "Paymob Pending Configuration",
        phone: "01012345678",
        email: "paymob-disabled@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "paymob",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 503);
    assert.deepEqual(response.json, { message: "Paymob checkout is not configured" });
  });

  assert.equal((await db.select({ id: orders.id }).from(orders)).length, 0);
  assert.equal((await db.select({ id: checkoutSessions.id }).from(checkoutSessions)).length, 0);
});

test("checkout route requires an idempotency key before Paymob initiation", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Paymob Idempotency", phone: "01012345678", email: "idempotency@capella.test",
        governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 10",
        buildingApartment: "4", paymentMethod: "paymob",
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(response.json, { message: "Idempotency-Key header is required for Paymob checkout" });
  });
});

test("checkout status exposes only the local result for an opaque checkout ID", async () => {
  const publicId = `checkout_${crypto.randomUUID()}`;
  await db.insert(checkoutSessions).values({
    publicId, idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Status Test",
    phone: "+201012345678", email: "status@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 1000,
    shippingAmountCents: 0, currency: "EGP", state: "payment_pending", attemptCount: 1,
    reservationExpiresAt: new Date("2026-09-11T12:30:00Z")
  });
  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/checkout/${publicId}/status?success=true&amount_cents=1`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.json, {
      checkoutId: publicId,
      status: "payment_pending",
      expiresAt: "2026-09-11T12:30:00.000Z",
      attemptsUsed: 1,
      latestAttemptStatus: null,
      canRetry: false,
      order: null
    });
  });
});

test("checkout retry remains unavailable while Paymob integrations are unconfirmed", async () => {
  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/checkout/checkout_${crypto.randomUUID()}/retry`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    assert.equal(response.status, 503);
    assert.deepEqual(response.json, { message: "Paymob checkout is not configured" });
  });
});

test("checkout status offers retry only after the latest attempt fails with time remaining", async () => {
  const publicId = `checkout_${crypto.randomUUID()}`;
  const [session] = await db.insert(checkoutSessions).values({
    publicId, idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Retry Status",
    phone: "+201012345678", email: "retry-status@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 1000,
    shippingAmountCents: 0, currency: "EGP", state: "payment_pending", attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
  }).$returningId();
  await db.insert(paymentAttempts).values({
    checkoutSessionId: session.id, attemptNumber: 1, merchantReference: `capella_${crypto.randomUUID()}`,
    amountCents: 1000, currency: "EGP", environment: "test", status: "failed"
  });
  await withTestServer(app, async (request) => {
    const response = await request(`/api/v1/checkout/${publicId}/status`);
    assert.equal(response.status, 200);
    assert.equal(response.json.attemptsUsed, 1);
    assert.equal(response.json.latestAttemptStatus, "failed");
    assert.equal(response.json.canRetry, true);
  });
});

test("checkout reports Paymob provider failure without exposing provider details as a validation error", async () => {
  const ids = await getBaselineIds();
  const originalFetch = global.fetch;
  const previous = Object.fromEntries(["PAYMOB_SECRET_KEY", "PAYMOB_PUBLIC_KEY", "PAYMOB_HMAC_SECRET",
    "PAYMOB_CARD_INTEGRATION_ID", "PAYMOB_CARD_INTEGRATION_CONFIRMED", "PAYMOB_NOTIFICATION_URL",
    "PAYMOB_REDIRECTION_URL"].map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    PAYMOB_SECRET_KEY: "secret", PAYMOB_PUBLIC_KEY: "public", PAYMOB_HMAC_SECRET: "hmac",
    PAYMOB_CARD_INTEGRATION_ID: "123", PAYMOB_CARD_INTEGRATION_CONFIRMED: "true",
    PAYMOB_NOTIFICATION_URL: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    PAYMOB_REDIRECTION_URL: "https://capellacares.com/checkout/payment-result"
  });
  global.fetch = ((input, init) => String(input).startsWith("https://accept.paymob.com/")
    ? Promise.resolve(new Response("provider diagnostic", { status: 503 }))
    : originalFetch(input, init)) as typeof fetch;
  try {
    await withTestServer(app, async (request) => {
      const response = await request("/api/v1/checkout", {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ fullName: "Provider Failure", phone: "01012345678", email: "provider-failure@example.com",
          governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
          paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] })
      });
      assert.equal(response.status, 502);
      assert.deepEqual(response.json, { message: "Payment provider is temporarily unavailable" });
    });
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("checkout retry reports Paymob provider failure as a sanitized 502", async () => {
  const publicId = `checkout_${crypto.randomUUID()}`;
  const [session] = await db.insert(checkoutSessions).values({
    publicId, idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Retry Provider",
    phone: "+201012345678", email: "retry-provider@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 1000,
    shippingAmountCents: 0, currency: "EGP", state: "payment_pending", attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
  }).$returningId();
  await db.insert(paymentAttempts).values({ checkoutSessionId: session.id, attemptNumber: 1,
    merchantReference: `capella_${crypto.randomUUID()}`, amountCents: 1000,
    currency: "EGP", environment: "test", status: "failed" });
  const originalFetch = global.fetch;
  const previous = Object.fromEntries(["PAYMOB_SECRET_KEY", "PAYMOB_PUBLIC_KEY", "PAYMOB_HMAC_SECRET",
    "PAYMOB_CARD_INTEGRATION_ID", "PAYMOB_CARD_INTEGRATION_CONFIRMED", "PAYMOB_NOTIFICATION_URL",
    "PAYMOB_REDIRECTION_URL"].map((key) => [key, process.env[key]]));
  Object.assign(process.env, { PAYMOB_SECRET_KEY: "secret", PAYMOB_PUBLIC_KEY: "public", PAYMOB_HMAC_SECRET: "hmac",
    PAYMOB_CARD_INTEGRATION_ID: "123", PAYMOB_CARD_INTEGRATION_CONFIRMED: "true",
    PAYMOB_NOTIFICATION_URL: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    PAYMOB_REDIRECTION_URL: "https://capellacares.com/checkout/payment-result" });
  global.fetch = ((input, init) => String(input).startsWith("https://accept.paymob.com/")
    ? Promise.resolve(new Response("provider diagnostic", { status: 503 }))
    : originalFetch(input, init)) as typeof fetch;
  try {
    await withTestServer(app, async (request) => {
      const response = await request(`/api/v1/checkout/${publicId}/retry`, {
        method: "POST", headers: { "content-type": "application/json" }, body: "{}"
      });
      assert.equal(response.status, 502);
      assert.deepEqual(response.json, { message: "Payment provider is temporarily unavailable" });
    });
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("checkout route rejects an invalid Bearer token without creating a guest order", async () => {
  const ids = await getBaselineIds();
  const before = await db.select({ id: orders.id }).from(orders);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer expired-or-invalid"
      },
      body: JSON.stringify({
        fullName: "Expired Customer",
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

    assert.equal(response.status, 401);
    assert.deepEqual(response.json, { message: "Unauthorized" });
  });

  const after = await db.select({ id: orders.id }).from(orders);
  assert.equal(after.length, before.length);
});

test("checkout route ignores guest-supplied customerId values", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Guest Spoof Attempt",
        phone: "01012345678",
        email: "guest-spoof@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        customerId: ids.customerId,
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);

    const [order] = await db
      .select({ customerType: orders.customerType, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.customerType, "guest");
    assert.equal(order?.customerId, null);
  });
});

test("checkout route uses the authenticated customer id instead of trusting the request body", async () => {
  const ids = await getBaselineIds();

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${issueCustomerToken(ids.customerId)}`
      },
      body: JSON.stringify({
        fullName: "Authenticated Customer",
        phone: "01012345678",
        email: "seed-customer@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        customerId: ids.customerId + 999,
        items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);

    const [order] = await db
      .select({ customerType: orders.customerType, customerId: orders.customerId })
      .from(orders)
      .where(eq(orders.id, response.json.id))
      .limit(1);

    assert.equal(order?.customerType, "registered");
    assert.equal(order?.customerId, ids.customerId);
  });
});

test("checkout route accepts buyable collection items", async () => {
  const ids = await getBaselineIds();

  const [createdCollection] = await db
    .insert(collections)
    .values({
      slug: `route-collection-${Date.now()}`,
      arName: "مجموعة مسار",
      enName: "Route Collection",
      fixedPrice: "90.00",
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();

  await db.insert(collectionItems).values([
    { collectionId: createdCollection.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: createdCollection.id, variantId: ids.secondVariantId, qty: 1 }
  ]);

  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Collection Customer",
        phone: "01012345678",
        email: "collection-route@capella.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street 10",
        buildingApartment: "Building 4",
        paymentMethod: "cod",
        items: [{ type: "collection", collectionId: createdCollection.id, qty: 1 }]
      })
    });

    assert.equal(response.status, 201);
    assert.ok(response.json.id);
  });
});
