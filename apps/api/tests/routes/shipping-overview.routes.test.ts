import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { db } from "@capella/database/src/db";
import { orderReviewFlags, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { app } from "../../src/app.js";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";

beforeEach(resetApiTestDatabase);

test("routine carrier sync jobs do not replace shipment actions in lists or order details", async () => {
  const f = await shippingSyncFixture();
  const [sync] = await db.insert(shippingWorkItems).values({ orderId: f.order.id, shipmentId: f.shipment.id,
    operation: "sync_delivery", status: "pending", idempotencyKey: "routine-sync", nextAttemptAt: new Date() }).$returningId();
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    for (const status of ["pending", "processing", "succeeded"] as const) {
      await db.update(shippingWorkItems).set({ status }).where(eq(shippingWorkItems.id, sync.id));
      const overview = await request("/api/erp/shipping", { headers: auth });
      const row = overview.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
      assert.equal(row.workItem?.operation, "create_delivery", status);
      assert.equal(row.workItem?.status, "succeeded", status);
      assert.equal(row.needsAttention, false, status);
      const detail = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
      assert.equal(detail.json.shipping.workItem?.operation, "create_delivery", status);
    }
  });
});

test("carrier sync failures needing attention stay visible in lists and order details", async () => {
  const f = await shippingSyncFixture();
  const [sync] = await db.insert(shippingWorkItems).values({ orderId: f.order.id, shipmentId: f.shipment.id,
    operation: "sync_delivery", status: "review_required", lastError: "SYNC_ACCOUNT_MISMATCH",
    idempotencyKey: "attention-sync", nextAttemptAt: new Date() }).$returningId();
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    for (const status of ["failed", "review_required"] as const) {
      await db.update(shippingWorkItems).set({ status }).where(eq(shippingWorkItems.id, sync.id));
      const overview = await request("/api/erp/shipping", { headers: auth });
      const row = overview.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
      assert.equal(row.workItem?.operation, "sync_delivery");
      assert.equal(row.needsAttention, true);
      const detail = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
      assert.equal(detail.json.shipping.workItem?.operation, "sync_delivery");
      assert.equal(detail.json.shipping.workItem?.lastError, "SYNC_ACCOUNT_MISMATCH");
    }
  });
});

test("shipping overview rejects malformed queries with 400", async () => {
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    for (const query of [
      "cursor=2026-09-29T12%3A00%3A00.000Z%7C1", "unexpected=value", "q[]=x", "pageSize=20", "pages=2",
      "sort=orderCode", "section=late", "status=lost", "payment=card", "from=2026-02-30", "to=tomorrow"
    ]) {
      const response = await request(`/api/erp/shipping?${query}`, { headers: auth });
      assert.equal(response.status, 400, query);
    }
  });
});

test("permission catalog exposes broad shipping grants with read dependency", async () => {
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/staff/permissions", { headers: auth });
    assert.equal(response.status, 200);
    const byKey = new Map(response.json.items.map((item: { key: string; dependencies: string[] }) => [item.key, item]));
    assert.deepEqual(byKey.get("shipping.read")?.dependencies, ["orders.read"]);
    assert.deepEqual(byKey.get("shipping.update_state")?.dependencies, ["shipping.read"]);
  });
});

test("staff without shipping.read cannot list shipments", async () => {
  await withTestServer(app, async request => {
    const auth = await getStaffAuthHeaders(request, { permissionKeys: ["orders.read"] });
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 403);
  });
});

test("admin lists linked shipment rows with order, carrier and collection facts", async () => {
  const f = await shippingSyncFixture();
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const row = response.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
    assert.ok(row, "linked order must appear in the shipment list");
    assert.equal(row.orderCode, f.order.orderCode);
    assert.equal(row.kind, "outgoing");
    assert.equal(row.trackingNumber, f.shipment.trackingNumber);
    assert.equal(row.carrierState, "created");
    assert.equal(row.manualState, null);
    assert.equal(row.custodyState, "unknown");
    assert.equal(row.size, "small");
    assert.equal(row.shippingAmountCents, 9729);
    assert.equal(row.paymentMethod, "cod");
    assert.equal(row.providerPaymentStatus, null);
    assert.equal(row.cancellationStatus, null);
    assert.equal(row.needsAttention, false);
    assert.equal(row.workItem?.status, "succeeded");
  });
});

test("open flags and failed send work mark a row as needing attention", async () => {
  const f = await shippingSyncFixture();
  await db.insert(orderReviewFlags).values({
    orderId: f.order.id, flagType: "address_review", reason: "Unclear address"
  });
  await db.update(shippingWorkItems).set({ status: "review_required", lastError: "Uncertain create" })
    .where(eq(shippingWorkItems.orderId, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const row = response.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
    assert.ok(row);
    assert.deepEqual(row.openFlagTypes, ["address_review"]);
    assert.equal(row.needsAttention, true);
    assert.equal(row.workItem?.status, "review_required");
    assert.equal(row.workItem?.lastError, "Uncertain create");
  });
});

test("orders with shipping snapshot but no linked shipment still list for recovery", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const row = response.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
    assert.ok(row, "unsent shipping order must appear in the shipment list");
    assert.equal(row.trackingNumber, null);
    assert.equal(row.carrierState, null);
    assert.equal(row.size, "small");
    assert.equal(row.workItem?.status, "pending");
  });
});

test("cancelled unsent orders report local cancellation instead of awaiting creation", async () => {
  const f = await shippingSyncFixture(false);
  const { orders } = await import("@capella/database/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(orders).set({ cancellationStatus: "cancelled" }).where(eq(orders.id, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const row = response.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
    assert.ok(row);
    assert.equal(row.cancellationStatus, "cancelled");
    assert.equal(row.carrierState, null);
  });
});

test("a create job stopped by a successful cancellation does not need attention", async () => {
  const f = await shippingSyncFixture(false);
  const { orders } = await import("@capella/database/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(orders).set({ cancellationStatus: "cancelled" }).where(eq(orders.id, f.order.id));
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "ORDER_NOT_DISPATCHABLE" })
    .where(eq(shippingWorkItems.orderId, f.order.id));
  await db.insert(shippingWorkItems).values({
    orderId: f.order.id, shipmentId: null, operation: "cancel_delivery",
    idempotencyKey: "cancel-out-1", status: "succeeded", nextAttemptAt: new Date()
  });
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const row = response.json.items.find((item: { orderId: number }) => item.orderId === f.order.id);
    assert.ok(row);
    assert.equal(row.needsAttention, false);
    assert.equal(row.workItem?.operation, "cancel_delivery");
    assert.equal(row.workItem?.status, "succeeded");
  });
});

test("linked return rows do not inherit the order cancellation", async () => {
  const f = await shippingSyncFixture();
  const { orders } = await import("@capella/database/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(orders).set({ cancellationStatus: "cancelled" }).where(eq(orders.id, f.order.id));
  await db.insert(shipments).values({
    orderId: f.order.id, kind: "return", provider: "bosta", trackingNumber: "R-9001",
    rawProviderState: "Return requested", normalizedState: "in_transit", size: "small",
    idempotencyKey: "return-9001"
  });
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const rows = response.json.items.filter((item: { orderId: number }) => item.orderId === f.order.id);
    const outgoing = rows.find((item: { kind: string }) => item.kind === "outgoing");
    const returnRow = rows.find((item: { kind: string }) => item.kind === "return");
    assert.equal(outgoing.cancellationStatus, "cancelled");
    assert.equal(returnRow.cancellationStatus, null);
  });
});

test("shipping overview pages rows newest first and reports the matching total", async () => {
  const older = await shippingSyncFixture();
  const newer = await shippingSyncFixture();
  const { listShippingPageRepo } = await import("../../src/modules/shipping/shipping-overview.repository.js");
  // One row per page so two orders make two pages without seeding 21.
  const first = await listShippingPageRepo({ page: 1, dir: "asc" }, 1);
  const second = await listShippingPageRepo({ page: 2, dir: "asc" }, 1);
  assert.deepEqual(first.items.map((row) => row.orderId), [newer.order.id]);
  assert.deepEqual(second.items.map((row) => row.orderId), [older.order.id]);
  assert.deepEqual(first.pagination, { page: 1, pageSize: 1, total: 2, totalPages: 2 });
});

test("the needs-attention section matches each row's own attention flag", async () => {
  // Only the first fixture is sent to the carrier: the fake carrier reuses one tracking number, so a second sent order
  // would (rightly) need attention for a tracking conflict.
  const calm = await shippingSyncFixture();
  const flagged = await shippingSyncFixture(false);
  await db.insert(orderReviewFlags).values({ orderId: flagged.order.id, flagType: "address_review", reason: "Unclear" });
  const failing = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "Carrier outage" }).where(eq(shippingWorkItems.orderId, failing.order.id));
  const stopped = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "ORDER_NOT_DISPATCHABLE" }).where(eq(shippingWorkItems.orderId, stopped.order.id));
  const reviewing = await shippingSyncFixture(false);
  await db.insert(shipments).values({ orderId: reviewing.order.id, kind: "return", provider: "bosta", trackingNumber: "R-7001",
    rawProviderState: "Return requested", normalizedState: "created", size: "small", idempotencyKey: "return-7001" });
  const [returnShipment] = await db.select().from(shipments).where(eq(shipments.trackingNumber, "R-7001"));
  await db.insert(shippingWorkItems).values({ orderId: reviewing.order.id, shipmentId: returnShipment.id, operation: "sync_delivery",
    status: "review_required", idempotencyKey: "return-sync-7001", nextAttemptAt: new Date() });

  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const all = await request("/api/erp/shipping", { headers: auth });
    const attention = await request("/api/erp/shipping?section=needs_attention", { headers: auth });
    const key = (row: { orderId: number; kind: string; shipmentId: number | null }) => `${row.orderId}:${row.kind}:${row.shipmentId}`;
    const expected = all.json.items.filter((row: { needsAttention: boolean }) => row.needsAttention).map(key).sort();
    assert.deepEqual(attention.json.items.map(key).sort(), expected);
    assert.equal(attention.json.pagination.total, expected.length);
    const attentionOrders = new Set(attention.json.items.map((row: { orderId: number }) => row.orderId));
    assert.equal(attentionOrders.has(flagged.order.id), true);
    assert.equal(attentionOrders.has(failing.order.id), true);
    assert.equal(attentionOrders.has(reviewing.order.id), true);
    assert.equal(attentionOrders.has(calm.order.id), false);
    assert.equal(attentionOrders.has(stopped.order.id), false);
    const reviewingRows = attention.json.items.filter((row: { orderId: number }) => row.orderId === reviewing.order.id);
    assert.deepEqual(reviewingRows.map((row: { kind: string }) => row.kind), ["return"]);
  });
});

test("shipping overview searches, filters and sorts on the server", async () => {
  const sent = await shippingSyncFixture();
  const unsent = await shippingSyncFixture(false);
  const { orders } = await import("@capella/database/drizzle/schema");
  await db.update(orders).set({ cancellationStatus: "cancelled", paymentMethod: "paymob" }).where(eq(orders.id, unsent.order.id));
  await db.insert(shipments).values({ orderId: sent.order.id, kind: "return", provider: "bosta", trackingNumber: "R-8001",
    rawProviderState: "Delivered", normalizedState: "delivered", size: "large", idempotencyKey: "return-8001" });

  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const rows = async (query: string) => (await request(`/api/erp/shipping?${query}`, { headers: auth })).json.items
      .map((row: { orderId: number; kind: string }) => `${row.orderId}:${row.kind}`);

    assert.deepEqual(await rows("section=returns"), [`${sent.order.id}:return`]);
    assert.deepEqual(await rows("status=delivered"), [`${sent.order.id}:return`]);
    assert.deepEqual(await rows("status=cancelled"), [`${unsent.order.id}:outgoing`]);
    assert.deepEqual(await rows("payment=paymob"), [`${unsent.order.id}:outgoing`]);
    assert.deepEqual(await rows("q=R-8001"), [`${sent.order.id}:return`]);
    assert.deepEqual(await rows(`q=${encodeURIComponent(unsent.order.orderCode)}`), [`${unsent.order.id}:outgoing`]);
    assert.deepEqual(await rows(`from=${encodeURIComponent(new Date(Date.now() + 86_400_000).toISOString())}`), []);
    // Carrier states sort in their natural order (created before delivered); rows without a carrier state go last.
    assert.deepEqual(await rows("sort=carrier"), [`${sent.order.id}:outgoing`, `${sent.order.id}:return`, `${unsent.order.id}:outgoing`]);
    assert.deepEqual(await rows("sort=carrier&dir=desc"), [`${sent.order.id}:return`, `${sent.order.id}:outgoing`, `${unsent.order.id}:outgoing`]);
  });
});

test("return rows keep their own manual state and work items", async () => {
  const f = await shippingSyncFixture();
  const { orders } = await import("@capella/database/drizzle/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(orders).set({ manualShippingState: "delivered" }).where(eq(orders.id, f.order.id));
  await db.insert(shipments).values({
    orderId: f.order.id, kind: "return", provider: "bosta", trackingNumber: "R-9001",
    rawProviderState: "Return requested", normalizedState: "created", size: "medium",
    idempotencyKey: "return-9001"
  });
  await db.insert(shippingWorkItems).values({
    orderId: f.order.id, shipmentId: null, operation: "cancel_delivery",
    idempotencyKey: "cancel-out-1", status: "failed", nextAttemptAt: new Date(), lastError: "Carrier outage"
  });
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const rows = response.json.items.filter((item: { orderId: number }) => item.orderId === f.order.id);
    const outgoing = rows.find((item: { kind: string }) => item.kind === "outgoing");
    const returnRow = rows.find((item: { kind: string }) => item.kind === "return");
    assert.equal(outgoing.manualState, "delivered");
    assert.equal(outgoing.workItem?.status, "failed");
    assert.equal(outgoing.workItem?.lastError, "Carrier outage");
    assert.equal(returnRow.manualState, null);
    assert.equal(returnRow.size, "medium");
    assert.equal(returnRow.workItem, null);
  });
});

test("return and exchange shipments list as separate rows for their order", async () => {
  const f = await shippingSyncFixture();
  await db.insert(shipments).values({
    orderId: f.order.id, kind: "return", provider: "bosta", trackingNumber: "R-9001",
    rawProviderState: "Return requested", normalizedState: "created", size: "small",
    idempotencyKey: "return-9001"
  });
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping", { headers: auth });
    assert.equal(response.status, 200);
    const rows = response.json.items.filter((item: { orderId: number }) => item.orderId === f.order.id);
    assert.deepEqual(rows.map((item: { kind: string }) => item.kind).sort(), ["outgoing", "return"]);
    const returnRow = rows.find((item: { kind: string }) => item.kind === "return");
    assert.equal(returnRow.trackingNumber, "R-9001");
  });
});
