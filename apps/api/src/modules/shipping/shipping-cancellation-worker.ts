import { randomUUID } from "node:crypto";
import { startIntervalWorker } from "../../services/interval-worker.js";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { directCancellationBlocked, finishShippingCancellation } from "../../repositories/shipping-cancellation.repository.js";
import { flagShippingOrder, stopUnsentDelivery } from "../../repositories/shipping-dispatch.repository.js";
import { recordShippingObservation, shippingRequestMatchesAccount } from "../../repositories/shipping-sync.repository.js";
import { BostaProviderError } from "./bosta/bosta-client.js";
import { resolveBostaCancellationRuntime, type BostaCancellationRuntime, type CancellationObservation } from "./bosta/bosta-cancellation.service.js";

type Job = typeof shippingWorkItems.$inferSelect;
const backoff = (attempt: number) => Math.min(900_000, 30_000 * 2 ** Math.max(0, attempt - 1));

async function claim(now: Date, leaseMs: number) {
  const expired = new Date(now.getTime() - leaseMs);
  const [candidate] = await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "cancel_delivery"),
    or(and(or(eq(shippingWorkItems.status, "pending"), eq(shippingWorkItems.status, "review_required")), lte(shippingWorkItems.nextAttemptAt, now)),
      and(eq(shippingWorkItems.status, "processing"), or(isNull(shippingWorkItems.claimedAt), lte(shippingWorkItems.claimedAt, expired))))))
    .orderBy(asc(shippingWorkItems.nextAttemptAt), asc(shippingWorkItems.id)).limit(1);
  if (!candidate) return null;
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, candidate.orderId)).limit(1).for("update");
    const [job] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, candidate.id)).limit(1).for("update");
    if (!order || !job || order.cancellationStatus !== "pending") return null;
    if (!(job.status === "processing" && (!job.claimedAt || job.claimedAt <= expired)) &&
      !(["pending", "review_required"].includes(job.status) && job.nextAttemptAt <= now)) return null;
    const [ship] = await tx.select().from(shipments).where(and(eq(shipments.orderId, order.id), eq(shipments.kind, "outgoing"))).limit(1).for("update");
    if (!ship && !await directCancellationBlocked(tx, order) && await stopUnsentDelivery(tx, order.id)) {
      await finishShippingCancellation(tx, order, now);
      return { complete: true as const };
    }
    const claimedBy = randomUUID();
    // Nine is the read-only recovery phase; at most eight attempts can authorize a mutation.
    const attemptCount = Math.min(9, job.attemptCount + 1);
    await tx.update(shippingWorkItems).set({ status: "processing", claimedBy, claimedAt: now, attemptCount, shipmentId: ship?.id ?? null })
      .where(eq(shippingWorkItems.id, job.id));
    return { complete: false as const, ship, job: { ...job, attemptCount, claimedBy } };
  });
}

async function postpone(job: Job, now: Date, code: string, review = false) {
  await db.transaction(async tx => {
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
    const [current] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, job.id)).limit(1).for("update");
    if (current?.status !== "processing" || current.claimedBy !== job.claimedBy) return;
    await tx.update(shippingWorkItems).set({ status: review ? "review_required" : "pending", lastError: code, claimedBy: null, claimedAt: null,
      nextAttemptAt: new Date(now.getTime() + backoff(job.attemptCount)) }).where(eq(shippingWorkItems.id, job.id));
    if (review || job.attemptCount >= 8) await flagShippingOrder(tx, job.orderId, "custody_review",
      "Cancellation cannot be safely confirmed; stock retained and dispatch blocked, reconcile carrier and custody with staff");
  });
}

/** Apply the observation first, then recheck under the order lock against all concurrent/local evidence. */
async function actOnProof(runtime: BostaCancellationRuntime, job: Job, proof: CancellationObservation, now: Date, mutate: boolean) {
  if (await recordShippingObservation(runtime.sync, proof.observation) !== "processed") return "blocked" as const;
  return db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
    const [current] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, job.id)).limit(1).for("update");
    const [ship] = await tx.select().from(shipments).where(eq(shipments.trackingNumber, proof.observation.trackingNumber)).limit(1).for("update");
    if (!order || order.cancellationStatus !== "pending" || current?.status !== "processing" || current.claimedBy !== job.claimedBy ||
      !ship || ship.orderId !== order.id || ship.idempotencyKey !== proof.observation.businessReference) return "blocked" as const;
    // Historical printing or actual collection survives later contradictory carrier flags.
    if (proof.printed || (proof.observation.collectedAmountCents ?? 0) > 0) {
      const previous = current.responseSnapshot ? JSON.parse(current.responseSnapshot) : {};
      await tx.update(shippingWorkItems).set({ responseSnapshot: JSON.stringify({ ...previous,
        ...(proof.printed ? { printingObservedAtMs: proof.observation.atMs } : {}),
        ...((proof.observation.collectedAmountCents ?? 0) > 0 ? { collectionObservedCents: proof.observation.collectedAmountCents } : {}), proof }) })
        .where(eq(shippingWorkItems.id, job.id));
    }
    if (ship.providerEventAtMs !== proof.observation.atMs || ship.rawProviderCode !== proof.observation.stateCode ||
      await directCancellationBlocked(tx, order) || proof.printed || !proof.prePickup || !proof.warehouseCustody) return "blocked" as const;
    if (proof.cancelled) {
      await tx.update(shippingWorkItems).set({ responseSnapshot: JSON.stringify({ accountId: runtime.sync.accountId,
        environment: runtime.sync.environment, cancellationConfirmed: true, proof }) }).where(eq(shippingWorkItems.id, job.id));
      await finishShippingCancellation(tx, order, now);
      return "complete" as const;
    }
    if (!mutate || !proof.canCancel || current.responseSnapshot !== null || current.attemptCount > 8 || current.lastError === "CANCEL_REJECTED") return "waiting" as const;
    // Durable marker before DELETE: a crash or timeout after this point allows reads only, even if no acknowledgment was saved.
    await tx.update(shippingWorkItems).set({ responseSnapshot: JSON.stringify({ mutationStarted: true,
      accountId: runtime.sync.accountId, environment: runtime.sync.environment, trackingNumber: ship.trackingNumber, businessReference: ship.idempotencyKey }) })
      .where(eq(shippingWorkItems.id, job.id));
    return "mutate" as const;
  });
}

export async function runShippingCancellationOnce(options: { runtime?: BostaCancellationRuntime | null; now?: Date; leaseMs?: number } = {}): Promise<boolean> {
  const now = options.now ?? new Date();
  const claimed = await claim(now, options.leaseMs ?? 120_000);
  if (!claimed) return false;
  if (claimed.complete) return true;
  const { job, ship } = claimed;
  if (!ship) { await postpone(job, now, "AWAITING_CREATE_RECONCILIATION"); return true; }
  let runtime: BostaCancellationRuntime | null;
  try { runtime = options.runtime === undefined ? resolveBostaCancellationRuntime() : options.runtime; }
  catch { await postpone(job, now, "CANCEL_ACCOUNT_UNVERIFIED", true); return true; }
  if (!runtime) { await postpone(job, now, "CANCEL_ACCOUNT_DISABLED"); return true; }
  const [intent] = await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "create_delivery"), eq(shippingWorkItems.idempotencyKey, ship.idempotencyKey))).limit(1);
  if (!intent || intent.orderId !== job.orderId || !shippingRequestMatchesAccount(intent.requestSnapshot, ship.idempotencyKey, runtime.sync)) {
    await postpone(job, now, "CANCEL_ACCOUNT_MISMATCH", true); return true;
  }
  let outcome: Awaited<ReturnType<typeof actOnProof>>;
  try { outcome = await actOnProof(runtime, job, await runtime.read(ship.trackingNumber, ship.idempotencyKey), now, true); }
  catch { await postpone(job, now, "CANCEL_READ_FAILED"); return true; }
  if (outcome === "complete") return true;
  if (outcome !== "mutate") { await postpone(job, now, outcome === "blocked" ? "CANCEL_CUSTODY_BLOCKED" : "CANCEL_CONFIRMATION_PENDING", outcome === "blocked"); return true; }
  try { await runtime.cancel(ship.trackingNumber); }
  catch (error) {
    if (error instanceof BostaProviderError && error.kind === "throttled") {
      await db.transaction(async tx => {
        await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
        await tx.update(shippingWorkItems).set({ responseSnapshot: null }).where(and(eq(shippingWorkItems.id, job.id), eq(shippingWorkItems.claimedBy, job.claimedBy!)));
      });
      await postpone(job, now, "CANCEL_THROTTLED");
    } else await postpone(job, now, error instanceof BostaProviderError && error.kind === "definitive" ? "CANCEL_REJECTED" : "CANCEL_UNCERTAIN", true);
    return true;
  }
  // HTTP success is not custody proof. A second correlated read must prove cancellation and retained warehouse custody.
  try {
    outcome = await actOnProof(runtime, job, await runtime.read(ship.trackingNumber, ship.idempotencyKey), now, false);
    if (outcome !== "complete") await postpone(job, now, outcome === "blocked" ? "CANCEL_CUSTODY_BLOCKED" : "CANCEL_CONFIRMATION_PENDING", outcome === "blocked");
  } catch { await postpone(job, now, "CANCEL_CONFIRMATION_PENDING"); }
  return true;
}

export function startShippingCancellationWorker(options: { intervalMs?: number } = {}): () => Promise<void> {
  return startIntervalWorker(async (isStopped) => {
    for (let count = 0; count < 10 && !isStopped(); count++) if (!await runShippingCancellationOnce()) break;
  }, options.intervalMs ?? 30_000,
  () => console.error("Shipping cancellation needs attention; configuration or database operation failed"));
}
