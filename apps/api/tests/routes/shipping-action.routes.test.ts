import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderReviewFlags, productVariants, shippingWorkItems } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { recordOrderManualState } from "../../src/modules/shipping/shipping-state.repository.js";
import { syncEnvironment } from "../helpers/bosta-sync.js";

beforeEach(resetApiTestDatabase);

test("unexpected failures in single and bulk shipping actions never expose internal details", async t => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    t.mock.method(db, "transaction", async () => { throw new Error("Authorization table not found: private-sentinel"); });
    for (const [path, body] of [
      ["retry", {}], ["reconcile", {}], ["manual-state", { state: "preparing" }],
      ["shipment-edit", { size: "medium" }], ["flags/1/resolve", { note: "Checked" }], ["cancel", {}]
    ] as const) {
      const single = await request(`/api/erp/shipping/orders/${f.order.id}/${path}`, { method: "POST",
        headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(single.status, 500, path);
      assert.deepEqual(single.json, { error: "Internal server error" }, path);
    }
    for (const action of ["retry", "reconcile", "manual_state", "shipment_edit", "resolve_flags", "cancel"]) {
      const bulk = await request("/api/erp/shipping/bulk", { method: "POST",
        headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ action, orderIds: [f.order.id], state: "preparing", patch: { size: "medium" }, note: "Checked" }) });
      assert.equal(bulk.status, 200, action);
      assert.deepEqual(bulk.json.results, [{ orderId: f.order.id, status: "error", message: "Internal server error" }], action);
    }
  });
});

test("unexpected bulk shipping failures return a generic per-order error", async t => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    t.mock.method(db, "transaction", async () => { throw new Error("Private database connection details"); });
    const bulk = await request("/api/erp/shipping/bulk", { method: "POST",
      headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ action: "retry", orderIds: [f.order.id] }) });
    assert.equal(bulk.status, 200);
    assert.deepEqual(bulk.json.results, [{ orderId: f.order.id, status: "error", message: "Internal server error" }]);
  });
});

test("bulk shipping keeps expected rejection messages", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const bulk = await request("/api/erp/shipping/bulk", { method: "POST",
      headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ action: "retry", orderIds: [f.order.id, 999999] }) });
    assert.equal(bulk.status, 200);
    assert.deepEqual(bulk.json.results, [
      { orderId: f.order.id, status: "error", message: "Only failed delivery creation can be retried; uncertain outcomes need reconciliation first" },
      { orderId: 999999, status: "error", message: "Shipping order not found" }
    ]);
  });
});

test("an address the carrier would reject is a client error, not a 500", async t => {
  // The address validator throws a checkout-shipping error, which the action routes did not
  // recognise. A schema-valid but carrier-invalid address therefore fell through to the
  // generic handler and surfaced as "Internal server error" - telling staff the platform
  // broke when the truth is simply that their address input was wrong.
  const f = await shippingSyncFixture(false);
  const env = { ...syncEnvironment, BOSTA_EDITS_ENABLED: "true",
    BOSTA_EDIT_SETTINGS_JSON: JSON.stringify({ accountVerified: true, accountEvidence: "controlled fixture only",
      accountId: "fixture", readContract: { verified: true, evidence: "controlled fixture only",
        editablePath: ["editAvailability", "editable"], prePickupPath: ["editAvailability", "prePickup"] } }) };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, env);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    // The destination ids must MATCH the order's locked snapshot: a mismatch is caught by an
    // earlier, different guard (cancellation required). Only a same-destination edit with a
    // too-short first line reaches the carrier-side address check under test.
    const snapshot = JSON.parse((await db.select({ shippingSnapshot: orders.shippingSnapshot })
      .from(orders).where(eq(orders.id, f.order.id)))[0].shippingSnapshot!);
    const response = await request(`/api/erp/shipping/orders/${f.order.id}/shipment-edit`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ address: { cityId: snapshot.address.cityId, zoneId: snapshot.address.zoneId,
        districtId: snapshot.address.districtId, addressLine: "x", buildingApartment: "1" } }) });
    assert.notEqual(response.status, 500, `an invalid address must never be reported as a server fault (got ${response.status}: ${JSON.stringify(response.json)})`);
    assert.equal(response.status, 400);
  });
});

test("single and bulk edits never expose malformed server configuration", async t => {
  const f = await shippingSyncFixture(false);
  const env = { ...syncEnvironment, BOSTA_EDITS_ENABLED: "true", BOSTA_EDIT_SETTINGS_JSON: "private-sentinel" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, env);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    for (const invalid of ["private-sentinel", JSON.stringify({ accountVerified: "private-sentinel" })]) {
      process.env.BOSTA_EDIT_SETTINGS_JSON = invalid;
      const single = await request(`/api/erp/shipping/orders/${f.order.id}/shipment-edit`, {
        method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ size: "medium" }) });
      assert.equal(single.status, 503);
      assert.deepEqual(single.json, { message: "Shipping provider configuration is unavailable" });
      const bulk = await request("/api/erp/shipping/bulk", { method: "POST", headers: { ...auth, "content-type": "application/json" },
        body: JSON.stringify({ action: "shipment_edit", orderIds: [f.order.id, 999999], patch: { size: "medium" } }) });
      assert.equal(bulk.status, 200);
      assert.deepEqual(bulk.json.results, [
        { orderId: f.order.id, status: "error", message: "Shipping provider configuration is unavailable" },
        { orderId: 999999, status: "error", message: "Shipping provider configuration is unavailable" }
      ]);
    }
  });
  assert.equal((await db.select().from(orders).where(eq(orders.id, f.order.id)))[0].shippingSize, "small");
});

test("edit reconciliation also keeps invalid synchronization settings out of single and bulk errors", async t => {
  const f = await shippingSyncFixture();
  await db.insert(shippingWorkItems).values({ orderId: f.order.id, shipmentId: f.shipment.id, operation: "edit_delivery", status: "processing",
    idempotencyKey: "pending-edit-config-error", nextAttemptAt: new Date() });
  const env = { ...syncEnvironment, BOSTA_SYNC_SETTINGS_JSON: "private-sentinel" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  Object.assign(process.env, env);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const single = await request(`/api/erp/shipping/orders/${f.order.id}/reconcile`, { method: "POST", headers: auth });
    assert.equal(single.status, 503);
    assert.deepEqual(single.json, { message: "Shipping provider configuration is unavailable" });
    const bulk = await request("/api/erp/shipping/bulk", { method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "reconcile", orderIds: [f.order.id] }) });
    assert.equal(bulk.status, 200);
    assert.deepEqual(bulk.json.results, [{ orderId: f.order.id, status: "error", message: "Shipping provider configuration is unavailable" }]);
  });
});

test("staff cancellation route runs the shared eligibility checks and restores sold stock once", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/shipping/orders/${f.order.id}/cancel`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ reason: "Customer request" })
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.status, "cancelled");
  });
  const [order] = await db.select().from(orders).where(eq(orders.id, f.order.id));
  assert.equal(order.cancellationStatus, "cancelled");
  assert.equal(order.paymentStatus, "denied");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 10);
});

test("shipment edit routes validate money locks and broad shipping grants", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const edit = (body: unknown, headers = auth) => request(`/api/erp/shipping/orders/${f.order.id}/shipment-edit`, {
      method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body)
    });
    assert.equal((await edit({ size: "medium", notes: "Packing correction" })).status, 200);
    assert.equal((await edit({ totalAmount: 1 })).status, 400);
    assert.equal((await edit({})).status, 400);
    const detail = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
    assert.equal(detail.json.shipping.packingSize, "medium");
    assert.equal(detail.json.shipping.editEnabled, true);
    assert.equal(detail.json.shipping.destination.districtId, "district-nasr");
    const reader = await getStaffAuthHeaders(request, { email: "edit-reader@test.example", permissionKeys: ["orders.read", "shipping.read"] });
    assert.equal((await edit({ size: "large" }, reader)).status, 403);
    await db.update(orders).set({ cancellationStatus: "pending" }).where(eq(orders.id, f.order.id));
    assert.equal((await edit({ notes: "Locked" })).status, 409);
  });
  assert.equal((await db.select().from(orders).where(eq(orders.id, f.order.id)))[0].shippingSize, "medium");
});

test("safety flag resolution requires shipping modification permission and records a note without stock or money effects", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "ORDER_NOT_DISPATCHABLE" }).where(eq(shippingWorkItems.id, f.job.id));
  const [flag] = await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType: "address_review", reason: "Wrong address" }).$returningId();
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const resolve = (body: unknown, headers = auth) => request(`/api/erp/shipping/orders/${f.order.id}/flags/${flag.id}/resolve`, {
      method: "POST", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body)
    });
    assert.equal((await resolve({ note: "" })).status, 400);
    const reader = await getStaffAuthHeaders(request, { email: "flag-reader@test.example", permissionKeys: ["orders.read", "shipping.read"] });
    assert.equal((await resolve({ note: "Checked" }, reader)).status, 403);
    assert.equal((await resolve({ note: "Address confirmed with customer" })).status, 200);
    assert.equal((await resolve({ note: "Already checked" })).status, 200);
    const detail = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
    assert.equal(detail.json.shipping.workItem?.operation, "create_delivery");
    assert.equal(detail.json.shipping.workItem?.status, "failed");
  });
  const [saved] = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.id, flag.id));
  assert.equal(saved.status, "resolved");
  assert.match(saved.reason, /Address confirmed with customer/);
  assert.ok(saved.resolvedAt);
  const [order] = await db.select().from(orders).where(eq(orders.id, f.order.id));
  assert.equal(order.paymentStatus, "pending");
  assert.equal(order.totalAmount, f.order.totalAmount);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});

test("bulk packing edits and flag resolution keep each order's guards", async () => {
  const f = await shippingSyncFixture(false);
  await db.insert(orderReviewFlags).values({ orderId: f.order.id, flagType: "address_review", reason: "Check address" });
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const bulk = (body: unknown) => request("/api/erp/shipping/bulk", { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    const edit = await bulk({ action: "shipment_edit", orderIds: [f.order.id, 999999], patch: { size: "medium" } });
    assert.equal(edit.status, 200);
    assert.deepEqual(edit.json.results.map((r: { status: string }) => r.status), ["ok", "error"]);
    const flags = await bulk({ action: "resolve_flags", orderIds: [f.order.id, 999999], note: "Address verified" });
    assert.equal(flags.status, 200);
    assert.deepEqual(flags.json.results.map((r: { status: string }) => r.status), ["ok", "error"]);
    const address = await bulk({ action: "shipment_edit", orderIds: [f.order.id], addressLines: { addressLine: "Corrected street", buildingApartment: "Building 5" } });
    assert.equal(address.status, 200);
    assert.equal(address.json.results[0].status, "ok");
  });
  assert.equal((await db.select().from(orderReviewFlags))[0].status, "resolved");
  assert.equal((await db.select().from(orders).where(eq(orders.id, f.order.id)))[0].addressLine, "Corrected street");
});

test("retry repository checks current actor permission and refuses cancelled orders", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "CREATE_REJECTED" }).where(eq(shippingWorkItems.id, f.job.id));
  const { retryOrderDeliveryCreation } = await import("../../src/modules/shipping/shipping-action.repository.js");
  await assert.rejects(retryOrderDeliveryCreation(f.order.id, 999999), /permission|authorized/i);
  await db.update(orders).set({ cancellationStatus: "cancelled" }).where(eq(orders.id, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/retry`, { method: "POST", headers: auth })).status, 409);
  });
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "failed");
});

test("historical printing blocks the staff cancellation route with a conflict", async () => {
  const f = await shippingSyncFixture(false);
  const actorId = await createTestAdminUser({ name: "Print admin", email: "cancel-print@example.test", passwordHash: "unused", role: "admin" });
  await recordOrderManualState(f.order.id, { state: "printed" }, actorId);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/shipping/orders/${f.order.id}/cancel`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({})
    });
    assert.equal(response.status, 409);
  });
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});

test("the cancellation route stays behind shipping.update_state and validates its input", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const staff = await getStaffAuthHeaders(request, { email: "cancel-denied@capella.test", permissionKeys: ["orders.read", "shipping.read"] });
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/cancel`, {
      method: "POST", headers: { ...staff, "content-type": "application/json" }, body: JSON.stringify({})
    })).status, 403);
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}junk/cancel`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({})
    })).status, 400);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/cancel`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ reason: "x".repeat(1001) })
    })).status, 400);
  });
});

test("the manual state route records staff state with history under shipping.update_state", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const staff = await getStaffAuthHeaders(request, {
      email: "state-grant@capella.test", permissionKeys: ["orders.read", "shipping.read", "shipping.update_state"]
    });
    const response = await request(`/api/erp/shipping/orders/${f.order.id}/manual-state`, {
      method: "POST", headers: { ...staff, "content-type": "application/json" }, body: JSON.stringify({ state: "preparing", reason: "Packing" })
    });
    assert.equal(response.status, 200);
    assert.equal(response.json.changed, true);
    const repeat = await request(`/api/erp/shipping/orders/${f.order.id}/manual-state`, {
      method: "POST", headers: { ...staff, "content-type": "application/json" }, body: JSON.stringify({ state: "preparing" })
    });
    assert.equal(repeat.status, 200);
    assert.equal(repeat.json.changed, false);
  });
  const [order] = await db.select().from(orders).where(eq(orders.id, f.order.id));
  assert.equal(order.manualShippingState, "preparing");
  const { orderStateHistory } = await import("@capella/database/drizzle/schema");
  assert.equal((await db.select().from(orderStateHistory).where(eq(orderStateHistory.orderId, f.order.id))).length, 1);
});

test("the manual state route rejects the retired manual Returned and invalid states with 400", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    for (const state of ["returned", "shipped", "unknown-state"]) {
      const response = await request(`/api/erp/shipping/orders/${f.order.id}/manual-state`, {
        method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ state })
      });
      assert.equal(response.status, 400, state);
    }
  });
  assert.equal((await db.select().from(orders).where(eq(orders.id, f.order.id)))[0].manualShippingState, null);
});

test("the manual state route maps missing orders and locked orders and stays behind shipping.update_state", async () => {
  const f = await shippingSyncFixture();
  await withTestServer(app, async request => {
    const reader = await getStaffAuthHeaders(request, { email: "state-reader@capella.test", permissionKeys: ["orders.read", "shipping.read"] });
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/manual-state`, {
      method: "POST", headers: { ...reader, "content-type": "application/json" }, body: JSON.stringify({ state: "preparing" })
    })).status, 403);
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request("/api/erp/shipping/orders/999999/manual-state", {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ state: "preparing" })
    })).status, 404);
    await db.update(orders).set({ paymentStatus: "denied" }).where(eq(orders.id, f.order.id));
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/manual-state`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ state: "preparing" })
    })).status, 409);
  });
});

test("staff retry re-enqueues a failed create job with reset attempts and the worker sends it once", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "CREATE_REJECTED", attemptCount: 8 })
    .where(eq(shippingWorkItems.orderId, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/shipping/orders/${f.order.id}/retry`, { method: "POST", headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.json.changed, true);
  });
  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, f.order.id));
  assert.equal(job.status, "pending");
  assert.equal(job.lastError, null);
  assert.equal(job.attemptCount, 0);
  const { runShippingDispatchOnce } = await import("../../src/modules/shipping/shipping-dispatch-worker.js");
  await runShippingDispatchOnce({ provider: f.provider });
  const { shipments } = await import("@capella/database/drizzle/schema");
  assert.equal((await db.select().from(shipments)).length, 1);
});

test("retry refuses jobs that are not failed and orders without shipping", async () => {
  const f = await shippingSyncFixture();
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/retry`, { method: "POST", headers: auth })).status, 409);
    assert.equal((await request("/api/erp/shipping/orders/999999/retry", { method: "POST", headers: auth })).status, 404);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}bad/retry`, { method: "POST", headers: auth })).status, 400);
  });
});

test("staff reconcile makes an uncertain create job due for read-only recovery without resending", async () => {
  const f = await shippingSyncFixture(false);
  const future = new Date(Date.now() + 600_000);
  await db.update(shippingWorkItems).set({ status: "review_required", lastError: "CREATE_UNCERTAIN", nextAttemptAt: future })
    .where(eq(shippingWorkItems.orderId, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/shipping/orders/${f.order.id}/reconcile`, { method: "POST", headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.json.changed, true);
  });
  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, f.order.id));
  assert.equal(job.status, "review_required");
  assert.ok(job.nextAttemptAt.getTime() <= Date.now(), "uncertain job must become due immediately");
  const { runShippingDispatchOnce } = await import("../../src/modules/shipping/shipping-dispatch-worker.js");
  assert.equal(await runShippingDispatchOnce({ provider: null }), false);
  const { shipments } = await import("@capella/database/drizzle/schema");
  assert.equal((await db.select().from(shipments)).length, 0);
});

test("staff can reconcile an uncertain eighth attempt instead of being permanently stuck at the attempt limit", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "review_required", lastError: "ATTEMPT_LIMIT_REVIEW", attemptCount: 8,
    requestSnapshot: JSON.stringify(f.provider.buildRequest(f.order, f.items, f.job.idempotencyKey)), nextAttemptAt: new Date(Date.now() + 600_000) })
    .where(eq(shippingWorkItems.id, f.job.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/reconcile`, { method: "POST", headers: auth })).status, 200);
  });
  const { runShippingDispatchOnce } = await import("../../src/modules/shipping/shipping-dispatch-worker.js");
  let reads = 0;
  await runShippingDispatchOnce({ provider: { ...f.provider, async create() { assert.fail("uncertain creation must not resend"); },
    async reconcile() { reads++; return { trackingNumber: "5108002", rawProviderCode: 10, rawProviderState: "Pickup requested", rawResponse: {} }; } } });
  assert.equal(reads, 1);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "succeeded");
});

test("reconcile refuses jobs without an uncertain create outcome", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "review_required", lastError: "TRACKING_CONFLICT" })
    .where(eq(shippingWorkItems.orderId, f.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    assert.equal((await request(`/api/erp/shipping/orders/${f.order.id}/reconcile`, { method: "POST", headers: auth })).status, 409);
  });
});

test("bulk actions keep per-record eligibility and report individual outcomes", async () => {
  const first = await shippingSyncFixture(false);
  const second = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "CREATE_REJECTED", attemptCount: 3 })
    .where(eq(shippingWorkItems.orderId, first.order.id));
  await db.update(shippingWorkItems).set({ status: "succeeded" })
    .where(eq(shippingWorkItems.orderId, second.order.id));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/shipping/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "retry", orderIds: [first.order.id, second.order.id, 999999] })
    });
    assert.equal(response.status, 200);
    const byOrder = new Map(response.json.results.map((item: { orderId: number; status: string }) => [item.orderId, item]));
    assert.equal(byOrder.get(first.order.id).status, "ok");
    assert.equal(byOrder.get(second.order.id).status, "error");
    assert.equal(byOrder.get(999999).status, "error");
  });
  const [retried] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, first.order.id));
  assert.equal(retried.status, "pending");
  const [untouched] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, second.order.id));
  assert.equal(untouched.status, "succeeded");
});

test("bulk manual state and cancellation apply the same per-record checks and validate input", async () => {
  const first = await shippingSyncFixture(false);
  const second = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const states = await request("/api/erp/shipping/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "manual_state", orderIds: [first.order.id, second.order.id], state: "preparing" })
    });
    assert.equal(states.status, 200);
    assert.equal(states.json.results.every((item: { status: string }) => item.status === "ok"), true);
    await db.update(orders).set({ manualShippingState: "printed" }).where(eq(orders.id, second.order.id));
    const cancel = await request("/api/erp/shipping/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel", orderIds: [first.order.id, second.order.id] })
    });
    assert.equal(cancel.status, 200);
    const byOrder = new Map(cancel.json.results.map((item: { orderId: number; status: string }) => [item.orderId, item]));
    assert.equal(byOrder.get(first.order.id).status, "ok");
    assert.equal(byOrder.get(second.order.id).status, "error");
    assert.equal((await request("/api/erp/shipping/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "manual_state", orderIds: [first.order.id], state: "returned" })
    })).status, 400);
    assert.equal((await request("/api/erp/shipping/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "retry", orderIds: [] })
    })).status, 400);
    assert.equal((await request("/api/erp/shipping/bulk", {
      method: "POST", headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ action: "destroy", orderIds: [first.order.id] })
    })).status, 400);
  });
});
