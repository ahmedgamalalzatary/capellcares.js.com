import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { orders, paymentWebhookEvents } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(resetApiTestDatabase);

test("public Paymob availability exposes no secrets and stays off until methods are confirmed", async () => {
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/payments/paymob/methods");
    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { available: false, methods: [] });
  });
});

test("Paymob webhook rejects an invalid HMAC before recording a processed event", async () => {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  process.env.PAYMOB_HMAC_SECRET = "test-hmac-secret";
  try {
    await withTestServer(app, async (request) => {
      const response = await request("/api/v1/payments/paymob/webhook?hmac=invalid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "TRANSACTION", obj: { id: 42 } })
      });
      assert.equal(response.status, 401);
      assert.deepEqual(response.json, { message: "Invalid Paymob callback signature" });
    });
    assert.equal((await db.select().from(paymentWebhookEvents)).length, 0);
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});

test("Paymob webhook records a valid unknown transaction once across duplicate delivery", async () => {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  process.env.PAYMOB_HMAC_SECRET = "test-hmac-secret";
  const callback = {
    type: "TRANSACTION",
    obj: {
      amount_cents: 10000, created_at: "2026-09-11T12:00:00Z", currency: "EGP",
      error_occured: false, has_parent_transaction: false, id: 42, integration_id: 5885253,
      is_3d_secure: true, is_auth: false, is_capture: false, is_refunded: false,
      is_standalone_payment: true, is_voided: false, order: { id: 9001 }, owner: 7,
      pending: false, source_data: { pan: "1234", sub_type: "MasterCard", type: "card" }, success: true, is_live: false
    }
  };
  const hmac = "b57f14363e3aee75b976893580b3974c953a61378af9fe96968839c1c1cc3a97da2a38bb6643bcc39d577f0188ad546355a5eedc10f9f85379f6be2ef74d270a";
  try {
    await withTestServer(app, async (request) => {
      for (let delivery = 0; delivery < 2; delivery += 1) {
        const response = await request(`/api/v1/payments/paymob/webhook?hmac=${hmac}`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(callback)
        });
        assert.equal(response.status, 202);
      }
    });
    const events = await db.select().from(paymentWebhookEvents);
    assert.equal(events.length, 1);
    assert.equal(events[0]?.processingStatus, "rejected");
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});

test("Paymob webhook rejects a signed callback with an invalid environment flag", async () => {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  process.env.PAYMOB_HMAC_SECRET = "test-hmac-secret";
  try {
    await withTestServer(app, async (request) => {
      const response = await request("/api/v1/payments/paymob/webhook?hmac=b57f14363e3aee75b976893580b3974c953a61378af9fe96968839c1c1cc3a97da2a38bb6643bcc39d577f0188ad546355a5eedc10f9f85379f6be2ef74d270a", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "TRANSACTION", obj: {
          amount_cents: 10000, created_at: "2026-09-11T12:00:00Z", currency: "EGP",
          error_occured: false, has_parent_transaction: false, id: 42, integration_id: 5885253,
          is_3d_secure: true, is_auth: false, is_capture: false, is_refunded: false,
          is_standalone_payment: true, is_voided: false, order: { id: 9001 }, owner: 7,
          pending: false, source_data: { pan: "1234", sub_type: "MasterCard", type: "card" },
          success: true, is_live: "false"
        } })
      });
      assert.equal(response.status, 422);
    });
    assert.equal((await db.select().from(paymentWebhookEvents)).length, 0);
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});

test("Paymob webhook creates the order from a verified matching transaction", async () => {
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Route Paid", phone: "01012345678", email: "route-paid@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }] },
    idempotencyKey: "44444444-4444-4444-8444-444444444444",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
      enabledMethods: [{ method: "card", integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_route_paid", orderId: 9003, clientSecret: "route_secret", checkoutUrl: "https://checkout" })
  });
  const previous = process.env.PAYMOB_HMAC_SECRET;
  process.env.PAYMOB_HMAC_SECRET = "test-hmac-secret";
  try {
    await withTestServer(app, async (request) => {
      const response = await request("/api/v1/payments/paymob/webhook?hmac=a44fd6a394da82d22a90f97102bb7b20d084266359ca1d59922016d4d07f66ca51a94b9da0bf13d352621e1f912396fd73d014f3275854a94f1b9bb8f641b30f", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "TRANSACTION", obj: { amount_cents: 7000, created_at: "2026-09-11T12:00:00Z", currency: "EGP",
          error_occured: false, has_parent_transaction: false, id: 7001, integration_id: 123, is_3d_secure: true,
          is_auth: false, is_capture: false, is_refunded: false, is_standalone_payment: true, is_voided: false,
          order: { id: 9003 }, owner: 7, pending: false, source_data: { pan: "1234", sub_type: "MasterCard", type: "card" }, success: true, is_live: false } })
      });
      assert.equal(response.status, 200);
      const refund = await request("/api/v1/payments/paymob/webhook?hmac=33b43e82670513625e887a1a7a461bd7d2e19fb44253e3bfe0d13698e6b8e13704ae8761cee3ed7c2a922ffcba3c649611258e018bce53b84ab18b35069a7db3", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "TRANSACTION", obj: { amount_cents: 7000, created_at: "2026-09-11T12:00:00Z", currency: "EGP",
          error_occured: false, has_parent_transaction: false, id: 7001, integration_id: 123, is_3d_secure: true,
          is_auth: false, is_capture: false, is_refunded: true, refunded_amount_cents: 7000,
          is_standalone_payment: true, is_voided: false, order: { id: 9003 }, owner: 7, pending: false,
          source_data: { pan: "1234", sub_type: "MasterCard", type: "card" }, success: true, is_live: false } })
      });
      assert.equal(refund.status, 200);
    });
    const [order] = await db.select().from(orders).where(eq(orders.email, "route-paid@example.com")).limit(1);
    assert.equal(order?.providerPaymentStatus, "refunded");
    const events = await db.select().from(paymentWebhookEvents);
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event.processingStatus === "processed"));
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET; else process.env.PAYMOB_HMAC_SECRET = previous;
  }
});
