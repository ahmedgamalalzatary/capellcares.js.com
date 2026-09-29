import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shippingWorkItems, productVariants } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { withTestServer } from "../helpers/request.js";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { recordOrderManualState } from "../../src/repositories/shipping-state.repository.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";

beforeEach(resetApiTestDatabase);
const headers = (id: number) => ({ authorization: `Bearer ${jwt.sign({ sub: id, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" })}` });
async function fixture(link = false) {
  const f = await shippingSyncFixture(link);
  await db.update(orders).set({ customerType: "registered", customerId: f.ids.customerId }).where(eq(orders.id, f.order.id));
  return f;
}
const staff = () => createTestAdminUser({ name: "Timeline staff", email: "timeline@example.test", passwordHash: "unused", role: "admin" });

test("owned order list and detail expose the same safe fulfillment state", async () => {
  const f = await fixture();
  await withTestServer(app, async request => {
    const detail = await request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    const list = await request("/api/v1/orders", { headers: headers(f.ids.customerId) });
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.json.fulfillment, { stage: "placed", status: "active", issue: null, canCancel: true, refundStatus: null, relatedShipments: [] });
    assert.deepEqual(list.json.items[0].fulfillment, detail.json.fulfillment);
    for (const key of ["shipping", "shippingSnapshot", "manualShippingState", "shippingPickupAtMs", "cancellationStatus"]) assert.equal(detail.json[key], undefined);
  });
});

test("customer cancellation stops unsent dispatch and restores sold stock once", async () => {
  const f = await fixture();
  await withTestServer(app, async request => {
    for (let i = 0; i < 2; i++) {
      const response = await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId) });
      assert.equal(response.status, 200);
      assert.equal(response.json.fulfillment.status, "cancelled");
      assert.equal(response.json.fulfillment.canCancel, false);
    }
  });
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 10);
  assert.equal((await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, f.job.id)))[0].status, "failed");
});

test("cancellation requires authentication and ownership and refuses caller-supplied actors or invalid ids", async () => {
  const f = await fixture();
  await withTestServer(app, async request => {
    assert.equal((await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST" })).status, 401);
    assert.equal((await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId + 1) })).status, 404);
    assert.equal((await request("/api/v1/orders/12junk/cancel", { method: "POST", headers: headers(f.ids.customerId) })).status, 400);
    assert.equal((await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: { ...headers(f.ids.customerId), "content-type": "application/json" }, body: JSON.stringify({ source: "staff", actorId: 1 }) })).status, 400);
    await db.update(orders).set({ customerType: "guest", customerId: null }).where(eq(orders.id, f.order.id));
    assert.equal((await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId) })).status, 404);
  });
});

test("historical printing hides cancellation and the API independently rejects it", async () => {
  const f = await fixture();
  const actor = await staff();
  await recordOrderManualState(f.order.id, { state: "printed" }, actor);
  await recordOrderManualState(f.order.id, { state: "preparing" }, actor);
  await withTestServer(app, async request => {
    const detail = await request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    assert.equal(detail.json.fulfillment.stage, "preparing");
    assert.equal(detail.json.fulfillment.canCancel, false);
    assert.equal((await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId) })).status, 409);
  });
});

test("linked cancellation reports pending while keeping stock and payment intact", async () => {
  const f = await fixture(true);
  await withTestServer(app, async request => {
    const response = await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId) });
    assert.equal(response.status, 202);
    assert.equal(response.json.fulfillment.status, "cancellation_pending");
    assert.equal(response.json.paymentStatus, "pending");
    assert.equal(response.json.fulfillment.canCancel, false);
  });
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});

test("paid cancellation exposes refund pending separately from a verified refund", async () => {
  const f = await fixture();
  await db.update(orders).set({ paymentMethod: "paymob", paymentStatus: "accepted", providerPaymentStatus: "succeeded" }).where(eq(orders.id, f.order.id));
  await withTestServer(app, async request => {
    const response = await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId) });
    assert.equal(response.status, 200);
    assert.equal(response.json.fulfillment.refundStatus, "pending");
    assert.equal(response.json.providerPaymentStatus, "succeeded");
    await db.update(orders).set({ providerPaymentStatus: "refunded", refundedAmountCents: 13229 }).where(eq(orders.id, f.order.id));
    assert.equal((await request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) })).json.fulfillment.refundStatus, "refunded");
  });
});

test("verified pickup and delivery advance the timeline and returns retain delivery history without proving a refund", async () => {
  const f = await fixture(true);
  const atMs = Date.now() - 20_000;
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 21, timeStamp: atMs })));
  await withTestServer(app, async request => {
    const read = () => request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    assert.equal((await read()).json.fulfillment.stage, "shipped");
    assert.equal((await read()).json.fulfillment.canCancel, false);
    await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp: atMs + 1 })));
    assert.equal((await read()).json.fulfillment.stage, "delivered");
    await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 46, type: "RTO", timeStamp: atMs + 2 })));
    const returned = (await read()).json.fulfillment;
    assert.equal(returned.stage, "delivered");
    assert.equal(returned.status, "returned");
    assert.equal(returned.refundStatus, null);
  });
});

test("address delays and linked exchange statuses are customer-readable without raw carrier or staff data", async () => {
  const f = await fixture(true);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 47, exceptionCode: 13 })));
  await db.insert(shipments).values({ orderId: f.order.id, provider: "bosta", kind: "exchange", trackingNumber: "exchange-fixture", idempotencyKey: "exchange_fixture", rawProviderState: "In transit", normalizedState: "in_transit" });
  await withTestServer(app, async request => {
    const response = await request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    assert.equal(response.json.fulfillment.status, "delayed");
    assert.equal(response.json.fulfillment.issue, "address");
    assert.deepEqual(response.json.fulfillment.relatedShipments, [{ kind: "exchange", status: "in_transit" }]);
    assert.equal(response.json.fulfillment.rawProviderCode, undefined);
    assert.equal(response.json.fulfillment.flags, undefined);
  });
});

test("carrier cancellation does not claim local order cancellation or a refund", async () => {
  const f = await fixture(true);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 49 })));
  await withTestServer(app, async request => {
    const response = await request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    assert.equal(response.json.fulfillment.status, "carrier_cancelled");
    assert.equal(response.json.fulfillment.refundStatus, null);
    assert.equal(response.json.paymentStatus, "pending");
  });
});

test("unresolved edits and partial refunds prevent customer cancellation while reads remain available", async () => {
  const f = await fixture(true);
  await db.insert(shippingWorkItems).values({ orderId: f.order.id, shipmentId: f.shipment.id, operation: "edit_delivery", status: "review_required", idempotencyKey: "unresolved_fixture", nextAttemptAt: new Date() });
  await withTestServer(app, async request => {
    const read = () => request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    assert.equal((await read()).json.fulfillment.canCancel, false);
    assert.equal((await request(`/api/v1/orders/${f.order.id}/cancel`, { method: "POST", headers: headers(f.ids.customerId) })).status, 409);
    await db.delete(shippingWorkItems).where(eq(shippingWorkItems.idempotencyKey, "unresolved_fixture"));
    await db.update(orders).set({ paymentMethod: "paymob", providerPaymentStatus: "partially_refunded", refundedAmountCents: 100 }).where(eq(orders.id, f.order.id));
    const partial = (await read()).json.fulfillment;
    assert.equal(partial.canCancel, false);
    assert.equal(partial.refundStatus, "partially_refunded");
  });
});

for (const scenario of [
  { type: "RTO", state: 100, issue: "lost" },
  { type: "EXCHANGE", state: 101, issue: "damaged" }
]) test(`a ${scenario.issue} ${scenario.type} parcel shows the exception instead of routine movement`, async () => {
  const f = await fixture(true);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ type: scenario.type, state: scenario.state })));
  await withTestServer(app, async request => {
    const response = await request(`/api/v1/orders/${f.order.id}`, { headers: headers(f.ids.customerId) });
    assert.equal(response.json.fulfillment.status, "exception");
    assert.equal(response.json.fulfillment.issue, scenario.issue);
  });
});
