import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orderReviewFlags, orders, productVariants, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { recordOrderManualState } from "../../src/repositories/shipping-state.repository.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";
import { findOrderByIdRepo, listOrdersRepo } from "../../src/repositories/order.repository.js";

beforeEach(resetApiTestDatabase);
test("ERP details show only this order's linked return/exchange evidence without changing money or stock", async () => {
  const f = await shippingSyncFixture();
  const other = await shippingSyncFixture(false);
  await db.update(orders).set({ manualShippingState: "delivered" }).where(eq(orders.id, f.order.id));
  const atMs = Date.now() - 1000;
  const inserted = await db.insert(shipments).values([
    { orderId: f.order.id, kind: "return", provider: "bosta", trackingNumber: "RETURN-DETAIL", size: "small",
      idempotencyKey: "return-detail", rawProviderState: "Returned to business", rawProviderCode: 46,
      rawProviderType: "CUSTOMER_RETURN_PICKUP", normalizedState: "returned", custodyState: "warehouse_uninspected", providerEventAtMs: atMs },
    { orderId: f.order.id, kind: "exchange", provider: "bosta", trackingNumber: "EXCHANGE-DETAIL", size: "medium",
      idempotencyKey: "exchange-detail", rawProviderState: "In transit", rawProviderCode: 30,
      rawProviderType: "EXCHANGE", normalizedState: "in_transit", custodyState: "carrier", manualState: "preparing" },
    { orderId: other.order.id, kind: "return", provider: "bosta", trackingNumber: "OTHER-RETURN", size: "small",
      idempotencyKey: "other-return-detail", rawProviderState: "Pickup requested", normalizedState: "created" }
  ]).$returningId();
  const before = await db.select().from(orders).where(eq(orders.id, f.order.id));
  const stock = await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId));
  await withTestServer(app, async request => {
    const staff = await getStaffAuthHeaders(request, { permissionKeys: ["orders.read"] });
    const response = await request(`/api/erp/orders/${f.order.id}`, { headers: { authorization: staff.authorization } });
    assert.equal(response.status, 200);
    assert.equal(response.json.shipping.manualState, "delivered");
    assert.equal(response.json.shipping.carrierState, "created");
    assert.deepEqual(response.json.shipping.relatedShipments, [
      { id: inserted[0].id, kind: "return", trackingNumber: "RETURN-DETAIL", manualState: null,
        carrierState: "returned", rawProviderState: "Returned to business", rawProviderCode: 46,
        rawProviderType: "CUSTOMER_RETURN_PICKUP", custodyState: "warehouse_uninspected", providerEventAtMs: atMs, workItem: null },
      { id: inserted[1].id, kind: "exchange", trackingNumber: "EXCHANGE-DETAIL", manualState: "preparing",
        carrierState: "in_transit", rawProviderState: "In transit", rawProviderCode: 30,
        rawProviderType: "EXCHANGE", custodyState: "carrier", providerEventAtMs: null, workItem: null }
    ]);
    assert.equal(response.json.paymentStatus, "pending");
    assert.equal(response.json.providerPaymentStatus, null);
    assert.equal(response.json.refundedAmountCents, 0);
  });
  assert.deepEqual(await db.select().from(orders).where(eq(orders.id, f.order.id)), before);
  assert.deepEqual(await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)), stock);
});

test("outgoing actions and related parcel errors select work for their own shipment and retain unresolved failures", async () => {
  const f = await shippingSyncFixture();
  const [related] = await db.insert(shipments).values({ orderId: f.order.id, kind: "return", provider: "bosta",
    trackingNumber: "RETURN-WORK", size: "small", idempotencyKey: "return-work", rawProviderState: "Pickup requested", normalizedState: "created" }).$returningId();
  await db.insert(shippingWorkItems).values([
    { orderId: f.order.id, shipmentId: f.shipment.id, operation: "cancel_delivery", idempotencyKey: "outgoing-detail-failed", status: "failed", lastError: "OUTGOING_FAILURE", nextAttemptAt: new Date() },
    { orderId: f.order.id, shipmentId: related.id, operation: "cancel_delivery", idempotencyKey: "return-detail-failed", status: "failed", lastError: "RETURN_FAILURE", nextAttemptAt: new Date() },
    { orderId: f.order.id, shipmentId: related.id, operation: "sync_delivery", idempotencyKey: "return-detail-success", status: "succeeded", nextAttemptAt: new Date() }
  ]);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.json.shipping.workItem.lastError, "OUTGOING_FAILURE");
    assert.equal(response.json.shipping.relatedShipments[0].workItem.lastError, "RETURN_FAILURE");
  });
});

test("admin order detail shows manual, carrier, payment, collection and custody independently", async () => {
  const f = await shippingSyncFixture();
  const actorId = await createTestAdminUser({ name: "Admin", email: "state-display@example.test", passwordHash: "unused", role: "admin" });
  await recordOrderManualState(f.order.id, { state: "delivered", reason: "Staff report" }, actorId);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 41, cod: undefined, isConfirmedDelivery: undefined })));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.json.shipping?.manualState, "delivered");
    assert.equal(response.json.shipping.carrierState, "in_transit");
    assert.equal(response.json.shipping.rawProviderType, "SEND");
    assert.equal(response.json.shipping.custodyState, "carrier");
    assert.equal(response.json.shipping.collection.confirmed, false);
    assert.equal(response.json.paymentStatus, "pending");
    assert.equal(response.json.shipping.history[0].actorId, actorId);
    assert.equal(response.json.shipping.history[0].reason, "Staff report");
    assert.equal(response.json.shipping.processing.untouchedExpiryApplies, false);
    assert.deepEqual(response.json.shipping.relatedShipments, []);
  });
});
test("staff payment changes cannot bypass Bosta evidence or silently include money/item edits", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const send = (body: unknown, id = String(f.order.id)) => request(`/api/erp/orders/${id}/payment-status`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await send({ paymentStatus: "accepted" })).status, 409);
    assert.equal((await send({ paymentStatus: "denied", items: [], totalAmount: 0 })).status, 400);
    assert.equal((await send({ paymentStatus: "denied" }, `${f.order.id}junk`)).status, 400);
  });
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});
test("order read permission remains enforced for new state details", async () => {
  const f = await shippingSyncFixture();
  await withTestServer(app, async request => {
    assert.equal((await request(`/api/erp/orders/${f.order.id}`)).status, 401);
    const auth = await getStaffAuthHeaders(request);
    assert.equal((await request(`/api/erp/orders/${f.order.id}`, { headers: { authorization: auth.authorization } })).status, 403);
  });
});
test("the open review flag feed shows every unresolved flag with order identity", async () => {
  const f = await shippingSyncFixture();
  await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType: "custody_review", reason: "Custody is unverified" });
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const list = await request("/api/erp/orders/review-flags", { headers: auth });
    assert.equal(list.status, 200);
    assert.equal(list.json.items.length, 1);
    assert.equal(list.json.items[0].flagType, "custody_review");
    assert.equal(list.json.items[0].orderId, f.order.id);
    assert.equal(list.json.items[0].orderCode, f.order.orderCode);
    assert.equal(list.json.items[0].status, "open");
  });
});

test("an informational alert can be acknowledged without a note and changes nothing on the order", async () => {
  const f = await shippingSyncFixture();
  await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType: "untouched_paid", reason: "Passed the deadline untouched" });
  const [flag] = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const resolved = await request(`/api/erp/orders/review-flags/${flag.id}/resolve`, { method: "POST", headers: auth });
    assert.equal(resolved.status, 200);
    assert.equal((await request("/api/erp/orders/review-flags", { headers: auth })).json.items.length, 0);
    // Acknowledging is pure staff visibility: it never denies, refunds or restocks the order.
    const [order] = await db.select().from(orders).where(eq(orders.id, f.order.id));
    assert.equal(order.paymentStatus, "pending");
    assert.equal(order.cancellationStatus, null);
  });
});

test("a shipping safety flag cannot be acknowledged, by read-only staff or by an admin", async () => {
  for (const flagType of ["custody_review", "address_review", "cancellation_pending", "refund_review", "expiry_review"] as const) {
    const f = await shippingSyncFixture();
    await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType, reason: `safety ${flagType}` });
    const [flag] = await db.select().from(orderReviewFlags).where(and(eq(orderReviewFlags.orderId, f.order.id), eq(orderReviewFlags.flagType, flagType)));
    const slug = `safety-reader-${flagType}`;
    await withTestServer(app, async request => {
      // Granted orders.read, so a 409 can only come from the safety check, never from RBAC.
      const staff = await getStaffAuthHeaders(request, { email: `${slug}@capella.test`, permissionKeys: ["orders.read"] });
      const readOnly = await request(`/api/erp/orders/review-flags/${flag.id}/resolve`, { method: "POST", headers: { authorization: staff.authorization } });
      assert.equal(readOnly.status, 409, flagType);
      // Even an admin may not resolve safety flags here; S13 owns the staff action.
      const auth = await getAdminAuthHeaders(request);
      const admin = await request(`/api/erp/orders/review-flags/${flag.id}/resolve`, { method: "POST", headers: auth });
      assert.equal(admin.status, 409, flagType);
    });
    const [stillOpen] = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.id, flag.id));
    assert.equal(stillOpen.status, "open", `${flagType} must survive a refused dismissal`);
  }
});

test("an informational alert is acknowledged by staff holding only orders.read", async () => {
  const f = await shippingSyncFixture();
  await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType: "untouched_paid", reason: "Passed the deadline" });
  const [flag] = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, f.order.id));
  await withTestServer(app, async request => {
    const staff = await getStaffAuthHeaders(request, { permissionKeys: ["orders.read"] });
    const resolved = await request(`/api/erp/orders/review-flags/${flag.id}/resolve`, { method: "POST", headers: { authorization: staff.authorization } });
    assert.equal(resolved.status, 200, "an informational alert is dismissible with only orders.read");
  });
  assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.id, flag.id)))[0].status, "resolved");
});

test("review flag alerts and their dismissal stay behind the orders read permission", async () => {
  const f = await shippingSyncFixture();
  await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType: "untouched_paid", reason: "Passed the deadline" });
  await withTestServer(app, async request => {
    assert.equal((await request("/api/erp/orders/review-flags")).status, 401);
    const staff = await getStaffAuthHeaders(request);
    assert.equal((await request("/api/erp/orders/review-flags", { headers: { authorization: staff.authorization } })).status, 403);
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request("/api/erp/orders/review-flags/999999/resolve", { method: "POST", headers: auth })).status, 404);
    assert.equal((await request("/api/erp/orders/review-flags/abc/resolve", { method: "POST", headers: auth })).status, 400);
  });
  assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, f.order.id)))[0].status, "open");
});

test("customer reads preserve ownership and do not expose internal staff processing fields", async () => {
  const f = await shippingSyncFixture();
  await db.update(orders).set({ customerType: "registered", customerId: f.ids.customerId, manualShippingState: "preparing", shippingProcessingAtMs: Date.now() });
  const detail = await findOrderByIdRepo(f.order.id, { customerId: f.ids.customerId });
  const list = await listOrdersRepo({ customerId: f.ids.customerId, withItems: true });
  for (const order of [detail, list[0]]) {
    for (const key of ["manualShippingState", "shippingProcessingAtMs", "shippingPickupAtMs", "shippingAddressBlockedAtMs", "shipping"]) assert.equal(Object.hasOwn(order!, key), false, key);
  }
  assert.equal(await findOrderByIdRepo(f.order.id, { customerId: f.ids.customerId + 99999 }), null);
});
