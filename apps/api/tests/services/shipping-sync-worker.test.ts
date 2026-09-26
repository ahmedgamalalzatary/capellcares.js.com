import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shippingWorkItems, shipmentEvents, orderReviewFlags } from "@capella/database/drizzle/schema";
import { resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { readFixture, syncEnvironment } from "../helpers/bosta-sync.js";
import { resolveBostaSyncRuntime } from "../../src/modules/shipping/bosta/bosta-sync.service.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";

beforeEach(resetApiTestDatabase);
async function worker() {
  const module = await import("../../src/modules/shipping/shipping-sync-worker.js").catch(() => null);
  assert.ok(module?.runShippingSyncOnce, "durable shipment synchronization is required");
  return module.runShippingSyncOnce;
}
const syncJob = async () => (await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.operation, "sync_delivery")))[0];

test("linked-shipment polling persists a job and collection evidence, then waits until the next due time", async () => {
  const f = await shippingSyncFixture();
  const calls: string[] = [];
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async (url, init) => {
    calls.push(`${init?.method} ${url}`);
    return Response.json(readFixture(f.job.idempotencyKey, { cod: 132.29 }));
  })!;
  const run = await worker();
  const now = new Date();
  assert.equal(await run({ runtime, now }), true);
  assert.deepEqual(calls, ["GET https://stg-app.bosta.co/api/v2/deliveries/business/5108002"]);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
  const job = await syncJob();
  assert.equal(job.shipmentId, f.shipment.id);
  assert.equal(job.status, "pending");
  assert.equal(job.attemptCount, 0);
  assert.ok(job.nextAttemptAt.getTime() > now.getTime());
  assert.equal(await run({ runtime, now }), false);
  assert.equal(calls.length, 1);
});
test("concurrent status workers claim only one read and persist one event", async () => {
  const f = await shippingSyncFixture();
  let calls = 0;
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async () => {
    calls++;
    return Response.json(readFixture(f.job.idempotencyKey));
  })!;
  const run = await worker();
  await Promise.all([run({ runtime }), run({ runtime })]);
  assert.equal(calls, 1);
  assert.equal((await db.select().from(shipmentEvents)).length, 1);
  assert.equal((await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.operation, "sync_delivery"))).length, 1);
});
test("read outage backs off durably and a later sweep recovers without sending a delivery", async () => {
  const f = await shippingSyncFixture();
  let healthy = false;
  const methods: string[] = [];
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async (_url, init) => {
    methods.push(init?.method ?? "");
    return healthy ? Response.json(readFixture(f.job.idempotencyKey)) : Response.json({ message: "Unavailable" }, { status: 503 });
  })!;
  const run = await worker();
  const now = new Date();
  await run({ runtime, now });
  const failed = await syncJob();
  assert.equal(failed.status, "pending");
  assert.equal(failed.attemptCount, 1);
  assert.equal(failed.lastError, "SYNC_READ_FAILED");
  assert.ok(failed.nextAttemptAt > now);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  healthy = true;
  await run({ runtime, now: new Date(failed.nextAttemptAt.getTime() + 1000) });
  assert.deepEqual(methods, ["GET", "GET"]);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
});
test("expired processing leases recover after restart, while fresh claims remain untouched", async () => {
  const f = await shippingSyncFixture();
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async () => Response.json(readFixture(f.job.idempotencyKey)))!;
  const run = await worker();
  await run({ runtime });
  const job = await syncJob();
  const now = new Date();
  await db.update(shippingWorkItems).set({ status: "processing", claimedBy: "crashed", claimedAt: now }).where(eq(shippingWorkItems.id, job.id));
  assert.equal(await run({ runtime, now }), false);
  assert.equal(await run({ runtime, now: new Date(now.getTime() + 121_000) }), true);
  assert.equal((await syncJob()).claimedBy, null);
});
test("an older read finishing after a webhook cannot regress its state or payment", async () => {
  const f = await shippingSyncFixture();
  const timeStamp = Date.now() - 10_000;
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async () => {
    await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp })));
    return Response.json(readFixture(f.job.idempotencyKey, { state: { code: 24, value: "Received at warehouse" }, updatedAt: new Date(timeStamp - 1).toISOString() }));
  })!;
  await (await worker())({ runtime });
  assert.equal((await db.select().from(shipments))[0].rawProviderCode, 45);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
  assert.equal((await db.select().from(shipmentEvents))[1].processingError, "STALE_EVENT");
});
test("disabled integration performs no reads, and a different account is flagged without a call", async () => {
  await shippingSyncFixture();
  const run = await worker();
  assert.equal(await run({ runtime: null }), false);
  assert.equal(await syncJob(), undefined);
  const runtime = { ...resolveBostaSyncRuntime(syncEnvironment)!, accountId: "different", read: async () => { throw new Error("must not call"); } };
  await run({ runtime });
  assert.equal((await syncJob()).status, "review_required");
  assert.equal((await syncJob()).lastError, "SYNC_ACCOUNT_MISMATCH");
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "custody_review");
});
test("provider HTTP off still replays early events after local linking", async () => {
  const f = await shippingSyncFixture(false);
  const frozen = f.provider.buildRequest(f.order, f.items, f.job.idempotencyKey);
  await db.update(shippingWorkItems).set({ requestSnapshot: JSON.stringify(frozen) }).where(eq(shippingWorkItems.id, f.job.id));
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body()));
  await runShippingDispatchOnce({ provider: f.provider });
  const runtime = resolveBostaSyncRuntime({ ...syncEnvironment, BOSTA_ENABLED: "false" })!;
  await (await worker())({ runtime });
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
  assert.ok((await db.select().from(shipmentEvents))[0].processedAt);
});
test("old orders without a linked shipment are never imported or polled", async () => {
  await shippingSyncFixture(false);
  await (await worker())({ runtime: resolveBostaSyncRuntime(syncEnvironment)! });
  assert.equal(await syncJob(), undefined);
});

test("a stale worker cannot overwrite the schedule owned by a newer lease", async () => {
  const f = await shippingSyncFixture();
  const run = await worker();
  const now = new Date();
  let newerSchedule: Date | undefined;
  const recovery = resolveBostaSyncRuntime(syncEnvironment, async () => Response.json(readFixture(f.job.idempotencyKey)))!;
  const original = resolveBostaSyncRuntime(syncEnvironment, async () => {
    assert.equal(await run({ runtime: recovery, now: new Date(now.getTime() + 121_000) }), true);
    newerSchedule = (await syncJob()).nextAttemptAt;
    return Response.json({ message: "Old read failed" }, { status: 503 });
  })!;
  await run({ runtime: original, now });
  const job = await syncJob();
  assert.equal(job.nextAttemptAt.getTime(), newerSchedule!.getTime());
  assert.equal(job.attemptCount, 0);
  assert.equal(job.lastError, null);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
});
test("repeated read failures flag staff once and continue read-only recovery", async () => {
  const f = await shippingSyncFixture();
  let healthy = false;
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async () => healthy ? Response.json(readFixture(f.job.idempotencyKey))
    : Response.json({}, { status: 503 }))!;
  const run = await worker();
  let now = new Date();
  for (let i = 0; i < 9; i++) {
    await run({ runtime, now });
    now = new Date((await syncJob()).nextAttemptAt.getTime() + 1000);
  }
  assert.equal((await syncJob()).status, "pending");
  assert.equal((await syncJob()).attemptCount, 8);
  assert.equal((await db.select().from(orderReviewFlags)).length, 1);
  healthy = true;
  await run({ runtime, now });
  assert.equal((await syncJob()).attemptCount, 0);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
});
