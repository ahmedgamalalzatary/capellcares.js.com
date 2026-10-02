import { randomUUID } from "node:crypto";
import { startIntervalWorker } from "../../services/interval-worker.js";
import { and, asc, count, eq, inArray, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderReviewFlags, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { flagShippingOrder } from "../../repositories/shipping-dispatch.repository.js";
import { isSafetyReviewFlag } from "../../repositories/order-review-flag.repository.js";
import { isFullyResolvedTerminal, TERMINAL_FOLLOW_UP_MS } from "../../repositories/shipping-sync-policy.js";
import { processPendingShippingEvents, recordShippingObservation, shippingRequestMatchesAccount } from "../../repositories/shipping-sync.repository.js";
import { resolveBostaSyncRuntime, type BostaObservation, type BostaSyncRuntime } from "./bosta/bosta-sync.service.js";

const backoff = (attempt: number) => Math.min(900_000, 30_000 * 2 ** Math.max(0, attempt - 1));
type Job = typeof shippingWorkItems.$inferSelect;
type ShippingSyncTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  // W07 B05: a parked job is finished forever. Excluding it here is what actually returns
  // read capacity to active parcels - rescheduling alone would leave it competing.
  const [candidate] = await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "sync_delivery"),
    ne(shippingWorkItems.syncPhase, "parked"),
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

async function finish(job: Job, now: Date, successful: boolean, observation?: BostaObservation) {
  await db.transaction(async tx => {
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
    const [current] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, job.id)).limit(1).for("update");
    if (!current || current.status !== "processing" || current.claimedBy !== job.claimedBy) return;

    // W07 B05: persist the scheduling decision, not an in-memory skip. A terminal parcel
    // gets exactly one follow-up read a day later, then parks - provided nothing is still
    // unresolved. Unresolved work keeps the normal cadence, so a correction is still seen.
    const phase = successful && observation ? await nextSyncPhase(tx, job, observation, now) : null;
    // MySQL DATETIME(0) rounds fractional seconds on insert, so floor to whole seconds
    // before persisting. Otherwise the stored value drifts a second ahead of what the
    // schedule actually means, and a follow-up could be considered due early.
    const at = (offsetMs: number) => new Date(Math.floor((now.getTime() + offsetMs) / 1000) * 1000);

    await tx.update(shippingWorkItems).set(phase
      ? { status: phase === "parked" ? "succeeded" : "pending", claimedBy: null, claimedAt: null, attemptCount: 0,
          lastError: null, syncPhase: phase,
          terminalFollowUpAt: phase === "terminal_followup" ? at(TERMINAL_FOLLOW_UP_MS) : null,
          // `active` means something is still unresolved, so it keeps the five-minute
          // cadence - NOT the follow-up delay. Only terminal_followup waits a day.
          nextAttemptAt: at(phase === "terminal_followup"
            ? TERMINAL_FOLLOW_UP_MS
            : phase === "parked" ? 3650 * 86_400_000 : 300_000) }
      : { status: "pending", claimedBy: null, claimedAt: null,
          attemptCount: successful ? 0 : job.attemptCount, lastError: successful ? null : "SYNC_READ_FAILED",
          nextAttemptAt: at(successful ? 300_000 : backoff(job.attemptCount)) })
      .where(eq(shippingWorkItems.id, job.id));
    if (!successful && job.attemptCount >= 8) await flagShippingOrder(tx, job.orderId, "custody_review",
      "Repeated carrier synchronization failures; automatic reads continue with backoff, verify shipment with staff");
  });
}

/**
 * Decide the next polling phase for a successful read.
 *
 * The first terminal read only schedules the follow-up; it does not park. Parking on the
 * terminal code alone would risk missing a late correction, which is why the follow-up
 * exists. If the parcel is no longer terminal, or was never fully resolved, it goes back
 * to `active` and the five-minute cadence.
 */
async function nextSyncPhase(
  tx: ShippingSyncTransaction,
  job: Job,
  observation: BostaObservation,
  now: Date
): Promise<"active" | "terminal_followup" | "parked"> {
  const [ship] = await tx.select().from(shipments).where(eq(shipments.id, job.shipmentId ?? -1)).limit(1).for("update");
  // A processed event can still be stale/rejected, or a newer webhook can have won
  // since the read. Only the accepted current observation may establish completion.
  if (!ship || ship.providerEventAtMs !== observation.atMs || ship.rawProviderCode !== observation.stateCode ||
    ship.collectedAmountCents !== observation.collectedAmountCents ||
    ship.collectionConfirmed !== observation.confirmedDelivery) return "active";
  const [pending] = await tx.select({ total: count() }).from(shippingWorkItems).where(and(
    eq(shippingWorkItems.orderId, job.orderId),
    inArray(shippingWorkItems.operation, ["edit_delivery", "cancel_delivery", "terminate_delivery"]),
    inArray(shippingWorkItems.status, ["pending", "processing", "review_required"])));
  // Open safety flags are unresolved money or custody questions. A parcel carrying one must
  // keep polling, or parking would retire the job and no automatic path would ever revisit
  // the discrepancy that the flag was raised to describe.
  const flags = await tx.select({ flagType: orderReviewFlags.flagType }).from(orderReviewFlags).where(and(
    eq(orderReviewFlags.orderId, job.orderId), eq(orderReviewFlags.status, "open")));
  const resolved = isFullyResolvedTerminal(observation, pending?.total ?? 0, flags.filter(flag => isSafetyReviewFlag(flag.flagType)).length);
  if (!resolved) return "active";
  // Arriving at the follow-up means the day has already elapsed; park if still resolved.
  return job.syncPhase === "terminal_followup" ? "parked" : "terminal_followup";
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
    await finish(claimed.job, now, result === "processed", event);
  } catch { await finish(claimed.job, now, false); }
  return true;
}

export function startShippingSyncWorker(options: { intervalMs?: number } = {}): () => Promise<void> {
  return startIntervalWorker(async (isStopped) => {
    for (let count = 0; count < 10 && !isStopped(); count++) if (!await runShippingSyncOnce()) break;
  }, options.intervalMs ?? 30_000,
  () => console.error("Shipping synchronization needs attention; configuration or database operation failed"));
}
