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

test("shipping overview rejects malformed queries, impossible dates and invalid cursor IDs with 400", async () => {
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    for (const query of [
      "cursor=garbage", "unexpected=value", "cursor[]=2026-09-29T12%3A00%3A00.000Z%7C1",
      ...["2026-99-99T12:00:00.000Z|1", "2026-02-30T12:00:00.000Z|1", "2026-09-29T24:00:00.000Z|1",
        "2026-09-29T12:00:00.000Z|0", "2026-09-29T12:00:00.000Z|01", "2026-09-29T12:00:00.000Z|2147483648"].map(cursor => `cursor=${encodeURIComponent(cursor)}`)
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

test("shipping overview paginates by cursor", async () => {
  const f1 = await shippingSyncFixture();
  await shippingSyncFixture();
  const { listShippingOverviewRepo } = await import("../../src/repositories/shipping-overview.repository.js");
  const page1 = await listShippingOverviewRepo(null, 1);
  assert.equal(page1.items.length, 1);
  assert.ok(page1.nextCursor, "page 1 must expose a cursor when more rows exist");
  const page2 = await listShippingOverviewRepo(
    { createdAt: new Date(page1.nextCursor!.split("|")[0]), id: Number(page1.nextCursor!.split("|")[1]) }, 1);
  assert.equal(page2.items.length, 1);
  assert.equal(page2.nextCursor, null);
  assert.notEqual(page1.items[0].orderId, page2.items[0].orderId);
});

test("route accepts the cursor query param and stops past the newest order", async () => {
  const f = await shippingSyncFixture();
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const first = await request("/api/erp/shipping", { headers: auth });
    assert.equal(first.status, 200);
    assert.equal(first.json.items.length, 1);
    assert.equal(first.json.nextCursor, null);
    const cursor = encodeURIComponent(`${f.order.createdAt.toISOString()}|${f.order.id}`);
    const after = await request(`/api/erp/shipping?cursor=${cursor}`, { headers: auth });
    assert.equal(after.status, 200);
    assert.deepEqual(after.json.items, []);
    assert.equal(after.json.nextCursor, null);
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
