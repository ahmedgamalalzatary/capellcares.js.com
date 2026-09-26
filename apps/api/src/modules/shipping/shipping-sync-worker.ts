import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { flagShippingOrder } from "../../repositories/shipping-dispatch.repository.js";
import { processPendingShippingEvents, recordShippingObservation, shippingRequestMatchesAccount } from "../../repositories/shipping-sync.repository.js";
import { resolveBostaSyncRuntime, type BostaSyncRuntime } from "./bosta/bosta-sync.service.js";

const backoff = (attempt: number) => Math.min(900_000, 30_000 * 2 ** Math.max(0, attempt - 1));
type Job = typeof shippingWorkItems.$inferSelect;

async function ensureJobs(now: Date) {
  const missing = await db.select({ ship: shipments }).from(shipments).leftJoin(shippingWorkItems,
    and(eq(shippingWorkItems.shipmentId, shipments.id), eq(shippingWorkItems.operation, "sync_delivery")))
    .where(and(eq(shipments.provider, "bosta"), isNull(shippingWorkItems.id))).orderBy(asc(shipments.id)).limit(10);
  for (const { ship } of missing) await db.transaction(async tx => {
    const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, ship.orderId)).limit(1).for("update");
    if (!order) return;
    const [current] = await tx.select().from(shipments).where(eq(shipments.id, ship.id)).limit(1).for("update");
    if (!current) return;
    const [existing] = await tx.select({ id: shippingWorkItems.id }).from(shippingWorkItems).where(and(
      eq(shippingWorkItems.shipmentId, ship.id), eq(shippingWorkItems.operation, "sync_delivery"))).limit(1).for("update");
    if (!existing) await tx.insert(shippingWorkItems).values({ orderId: order.id, shipmentId: ship.id,
      operation: "sync_delivery", status: "pending", idempotencyKey: `bosta_sync_${ship.id}`,
      nextAttemptAt: new Date(Math.floor(now.getTime() / 1000) * 1000) });
  });
}

async function claim(runtime: BostaSyncRuntime, now: Date, leaseMs: number) {
  const expired = new Date(now.getTime() - leaseMs);
  const [candidate] = await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "sync_delivery"),
    or(and(eq(shippingWorkItems.status, "pending"), lte(shippingWorkItems.nextAttemptAt, now)),
      and(eq(shippingWorkItems.status, "processing"), or(isNull(shippingWorkItems.claimedAt), lte(shippingWorkItems.claimedAt, expired))))))
    .orderBy(asc(shippingWorkItems.nextAttemptAt), asc(shippingWorkItems.id)).limit(1);
  if (!candidate) return null;
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, candidate.orderId)).limit(1).for("update");
    const [ship] = await tx.select().from(shipments).where(eq(shipments.id, candidate.shipmentId ?? -1)).limit(1).for("update");
    const [job] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, candidate.id)).limit(1).for("update");
    if (!order || !job) return null;
    if (!(job.status === "pending" && job.nextAttemptAt <= now) &&
      !(job.status === "processing" && (!job.claimedAt || job.claimedAt <= expired))) return null;
    const [intent] = ship ? await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "create_delivery"),
      eq(shippingWorkItems.idempotencyKey, ship.idempotencyKey))).limit(1).for("update") : [];
    if (!ship || ship.orderId !== order.id || !intent || intent.orderId !== order.id ||
      !shippingRequestMatchesAccount(intent.requestSnapshot, ship.idempotencyKey, runtime)) {
      await tx.update(shippingWorkItems).set({ status: "review_required", lastError: "SYNC_ACCOUNT_MISMATCH", claimedBy: null, claimedAt: null })
        .where(eq(shippingWorkItems.id, job.id));
      await flagShippingOrder(tx, order.id, "custody_review", "Shipment synchronization account/reference is unverified; provider read blocked");
      return { blocked: true as const };
    }
    const claimedBy = randomUUID();
    const attemptCount = Math.min(8, job.attemptCount + 1);
    await tx.update(shippingWorkItems).set({ status: "processing", claimedBy, claimedAt: now, attemptCount,
      requestSnapshot: JSON.stringify({ accountId: runtime.accountId, environment: runtime.environment,
        trackingNumber: ship.trackingNumber, businessReference: ship.idempotencyKey }) }).where(eq(shippingWorkItems.id, job.id));
    return { blocked: false as const, ship, job: { ...job, claimedBy, attemptCount } };
  });
}

async function finish(job: Job, now: Date, successful: boolean) {
  await db.transaction(async tx => {
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
    const [current] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, job.id)).limit(1).for("update");
    if (!current || current.status !== "processing" || current.claimedBy !== job.claimedBy) return;
    await tx.update(shippingWorkItems).set({ status: "pending", claimedBy: null, claimedAt: null,
      attemptCount: successful ? 0 : job.attemptCount, lastError: successful ? null : "SYNC_READ_FAILED",
      nextAttemptAt: new Date(now.getTime() + (successful ? 300_000 : backoff(job.attemptCount))) }).where(eq(shippingWorkItems.id, job.id));
    if (!successful && job.attemptCount >= 8) await flagShippingOrder(tx, job.orderId, "custody_review",
      "Repeated carrier synchronization failures; automatic reads continue with backoff, verify shipment with staff");
  });
}

export async function runShippingSyncOnce(options: { runtime?: BostaSyncRuntime | null; now?: Date; leaseMs?: number } = {}): Promise<boolean> {
  const runtime = options.runtime === undefined ? resolveBostaSyncRuntime() : options.runtime;
  if (!runtime) return false;
  const replayed = await processPendingShippingEvents(runtime);
  if (!runtime.canRead) return replayed > 0;
  const now = options.now ?? new Date();
  await ensureJobs(now);
  const claimed = await claim(runtime, now, options.leaseMs ?? 120_000);
  if (!claimed) return replayed > 0;
  if (claimed.blocked) return true;
  try {
    const event = await runtime.read(claimed.ship.trackingNumber, claimed.ship.idempotencyKey);
    const result = await recordShippingObservation(runtime, event);
    await finish(claimed.job, now, result === "processed");
  } catch { await finish(claimed.job, now, false); }
  return true;
}

export function startShippingSyncWorker(options: { intervalMs?: number } = {}): () => void {
  let running = false;
  let stopped = false;
  const sweep = async () => {
    if (running || stopped) return;
    running = true;
    try { for (let count = 0; count < 10 && !stopped; count++) if (!await runShippingSyncOnce()) break; }
    catch { console.error("Shipping synchronization needs attention; configuration or database operation failed"); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void sweep(); }, options.intervalMs ?? 30_000);
  void sweep();
  return () => { stopped = true; clearInterval(timer); };
}
