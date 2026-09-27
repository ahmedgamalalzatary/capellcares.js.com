import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shippingWorkItems, productVariants, shipments, orderReviewFlags } from "@capella/database/drizzle/schema";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { cancellationEnvironment } from "../helpers/bosta-cancellation.js";
import { readFixture } from "../helpers/bosta-sync.js";
import { requestShippingCancellation } from "../../src/repositories/shipping-cancellation.repository.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";

beforeEach(resetApiTestDatabase);
async function worker(options: Record<string, unknown>) {
  const module = await import("../../src/modules/shipping/shipping-cancellation-worker.js").catch(() => null);
  assert.ok(module?.runShippingCancellationOnce, "durable cancellation worker is required");
  return module.runShippingCancellationOnce(options);
}
async function runtime(fetchImpl: typeof fetch) {
  const module = await import("../../src/modules/shipping/bosta/bosta-cancellation.service.js").catch(() => null);
  assert.ok(module?.resolveBostaCancellationRuntime, "verified cancellation runtime is required");
  return module.resolveBostaCancellationRuntime(cancellationEnvironment, fetchImpl);
}
const current = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];
const job = async (id: number) => (await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, id), eq(shippingWorkItems.operation, "cancel_delivery"))))[0];
const stock = async (id: number) => (await db.select().from(productVariants).where(eq(productVariants.id, id)))[0].stockQty;
async function request(id: number) {
  const actorId = await createTestAdminUser({ name: "Cancel admin", email: "cancel-worker@example.test", passwordHash: "unused", role: "admin" });
  return requestShippingCancellation(id, { source: "staff", actorId });
}
function response(reference: string, cancelled: boolean, changes: Record<string, unknown> = {}) {
  return Response.json(readFixture(reference, { state: { code: cancelled ? 49 : 10, value: cancelled ? "Canceled" : "Pickup requested" },
    cod: 132.29, collection: { amount: null, confirmed: false }, updatedAt: new Date(Date.now() - (cancelled ? 500 : 1000)).toISOString(),
    cancelProof: { printed: false, prePickup: true, warehouse: true, allowed: !cancelled, cancelled }, ...changes }));
}

test("linked cancellation confirms carrier cancellation and warehouse custody before restoring stock once", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let deletes = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; assert.equal((await current(f.order.id)).cancellationStatus, "pending"); return Response.json({ success: true }); }
    return response(f.job.idempotencyKey, deletes > 0);
  });
  await worker({ runtime: provider });
  await worker({ runtime: provider });
  assert.equal(deletes, 1, JSON.stringify(await job(f.order.id)));
  assert.equal((await current(f.order.id)).cancellationStatus, "cancelled");
  assert.equal((await job(f.order.id)).status, "succeeded");
  assert.equal(await stock(f.ids.firstVariantId), 10);
  assert.equal((await db.select().from(shipments))[0].custodyState, "unknown", "carrier cancellation itself must not fabricate custody");
  assert.equal((await db.select().from(orderReviewFlags).where(and(eq(orderReviewFlags.flagType, "custody_review"), eq(orderReviewFlags.status, "open")))).length, 0,
    "a safely verified cancellation must not create a false custody conflict");
});

test("an uncertain DELETE outcome permits recovery reads only and never sends cancellation twice", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let deletes = 0;
  let proven = false;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; throw new Error("Lost cancel response"); }
    return response(f.job.idempotencyKey, proven);
  });
  await worker({ runtime: provider });
  assert.equal(await stock(f.ids.firstVariantId), 9);
  let saved = await job(f.order.id);
  await worker({ runtime: provider, now: new Date(saved.nextAttemptAt.getTime() + 1000) });
  assert.equal(deletes, 1);
  proven = true;
  saved = await job(f.order.id);
  await worker({ runtime: provider, now: new Date(saved.nextAttemptAt.getTime() + 1000) });
  assert.equal(deletes, 1, JSON.stringify(await job(f.order.id)));
  assert.equal(await stock(f.ids.firstVariantId), 10);
});

test("carrier printing or pickup forbids direct cancellation and keeps stock held for staff", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let deletes = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; throw new Error("Must not cancel"); }
    return response(f.job.idempotencyKey, false, { state: { code: 21, value: "Picked up from business" },
      cancelProof: { printed: true, prePickup: false, warehouse: false, allowed: false, cancelled: false } });
  });
  await worker({ runtime: provider });
  assert.equal(deletes, 0);
  assert.equal((await current(f.order.id)).cancellationStatus, "pending");
  assert.equal((await job(f.order.id)).status, "review_required");
  assert.equal(await stock(f.ids.firstVariantId), 9);
});

test("newer pickup evidence racing cancellation prevents a stale cancelled read from restocking", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let deletes = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") {
      deletes++;
      await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 21, timeStamp: Date.now() })));
      return Response.json({ success: true });
    }
    return response(f.job.idempotencyKey, deletes > 0);
  });
  await worker({ runtime: provider });
  assert.equal(deletes, 1);
  assert.equal(await stock(f.ids.firstVariantId), 9);
  assert.equal((await current(f.order.id)).paymentStatus, "pending");
});

test("concurrent cancellation workers issue one mutation and preserve a late successful create", async () => {
  const f = await shippingSyncFixture(false);
  const create = { ...f.provider, create: async () => {
    await request(f.order.id);
    return { trackingNumber: "5108002", rawProviderCode: 10, rawProviderState: "Pickup requested", rawResponse: {} };
  } };
  await runShippingDispatchOnce({ provider: create });
  assert.equal((await current(f.order.id)).cancellationStatus, "pending");
  assert.equal((await db.select().from(shipments)).length, 1);
  let deletes = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; return Response.json({ success: true }); }
    return response(f.job.idempotencyKey, deletes > 0);
  });
  await Promise.all([worker({ runtime: provider }), worker({ runtime: provider })]);
  assert.equal(deletes, 1);
  assert.equal(await stock(f.ids.firstVariantId), 10);
});

test("disabled account or unproven create outcome leaves cancellation pending without releasing stock", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "processing", claimedAt: new Date(), claimedBy: "inflight" });
  await request(f.order.id);
  await worker({ runtime: null });
  assert.equal((await current(f.order.id)).cancellationStatus, "pending");
  assert.equal(await stock(f.ids.firstVariantId), 9);
  assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.flagType, "cancellation_pending"))).length, 1);
});

test("throttled cancellation mutations stop after eight attempts while recovery reads continue", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let deletes = 0;
  let reads = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; return Response.json({ message: "Rate limited" }, { status: 429 }); }
    reads++;
    return response(f.job.idempotencyKey, false);
  });
  for (let attempt = 0; attempt < 10; attempt++) {
    const saved = await job(f.order.id);
    await worker({ runtime: provider, now: new Date(saved.nextAttemptAt.getTime() + 1000) });
  }
  assert.equal(deletes, 8);
  assert.equal(reads, 10);
  assert.equal(await stock(f.ids.firstVariantId), 9);
});

test("an expired cancellation lease with a persisted mutation marker recovers by reading without another DELETE", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  const saved = await job(f.order.id);
  await db.update(shippingWorkItems).set({ status: "processing", claimedBy: "crashed", claimedAt: new Date(Date.now() - 300_000),
    responseSnapshot: JSON.stringify({ mutationStarted: true }) }).where(eq(shippingWorkItems.id, saved.id));
  let deletes = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; throw new Error("Must not cancel twice"); }
    return response(f.job.idempotencyKey, true);
  });
  await worker({ runtime: provider });
  assert.equal(deletes, 0);
  assert.equal(await stock(f.ids.firstVariantId), 10);
});

test("verified carrier printing remains a cancellation barrier after a later read reports unprinted and cancelled", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let printed = true;
  let deletes = 0;
  const provider = await runtime(async (_input, init) => {
    if (init?.method === "DELETE") { deletes++; throw new Error("Must not cancel a printed shipment"); }
    return response(f.job.idempotencyKey, !printed, { cancelProof: { printed, prePickup: true, warehouse: true, allowed: !printed, cancelled: !printed } });
  });
  await worker({ runtime: provider });
  printed = false;
  const saved = await job(f.order.id);
  await worker({ runtime: provider, now: new Date(saved.nextAttemptAt.getTime() + 1000) });
  assert.equal(deletes, 0);
  assert.equal(await stock(f.ids.firstVariantId), 9);
  assert.equal((await current(f.order.id)).cancellationStatus, "pending");
});

test("positive actual collection contradicts safe cancellation even when delivery confirmation is false", async () => {
  const f = await shippingSyncFixture();
  await request(f.order.id);
  let amount: number | null = 132.29;
  const provider = await runtime(async () => response(f.job.idempotencyKey, true, { collection: { amount, confirmed: false } }));
  await worker({ runtime: provider });
  assert.equal(await stock(f.ids.firstVariantId), 9);
  assert.equal((await current(f.order.id)).cancellationStatus, "pending");
  amount = null;
  const saved = await job(f.order.id);
  await worker({ runtime: provider, now: new Date(saved.nextAttemptAt.getTime() + 1000) });
  assert.equal(await stock(f.ids.firstVariantId), 9);
});

for (const payment of ["cod", "paymob", "refunded_paymob"] as const) {
  test(`matching carrier cancellation after safe ${payment} cancellation does not reopen custody review`, async () => {
    const f = await shippingSyncFixture();
    if (payment !== "cod") await db.update(orders).set({ paymentMethod: "paymob", paymentStatus: "accepted",
      providerPaymentStatus: "succeeded" }).where(eq(orders.id, f.order.id));
    await request(f.order.id);
    let cancelled = false;
    const provider = await runtime(async (_input, init) => {
      if (init?.method === "DELETE") { cancelled = true; return Response.json({ success: true }); }
      return response(f.job.idempotencyKey, cancelled);
    });
    await worker({ runtime: provider });
    if (payment === "refunded_paymob") await db.update(orders).set({ paymentStatus: "denied",
      providerPaymentStatus: "refunded", refundedAmountCents: 13229 }).where(eq(orders.id, f.order.id));
    const atMs = Date.now() + 1000;
    await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 49, isConfirmedDelivery: false, timeStamp: atMs })));
    const flags = () => db.select().from(orderReviewFlags).where(and(eq(orderReviewFlags.orderId, f.order.id),
      eq(orderReviewFlags.flagType, "custody_review"), eq(orderReviewFlags.status, "open")));
    assert.equal((await flags()).length, 0);
    assert.equal((await current(f.order.id)).cancellationStatus, "cancelled");
    assert.equal(await stock(f.ids.firstVariantId), 10);
    // A subsequent contradictory pickup must still alert staff without repeating stock effects.
    await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 21, isConfirmedDelivery: false, timeStamp: atMs + 1 })));
    assert.equal((await flags()).length, 1);
    assert.equal(await stock(f.ids.firstVariantId), 10);
  });
}
