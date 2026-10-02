import { randomUUID } from "node:crypto";
import { startIntervalWorker } from "../../services/interval-worker.js";
import { and, asc, eq, isNull, isNotNull, lte, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orderItems, orders, orderReviewFlags, paymentAttempts, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { hasUnresolvedFinancialEvidence, sessionPaymobOrderIds, unresolvedInboxOrderIds } from "../checkout/financial-evidence.repository.js";
import { flagShippingOrder } from "./shipping-dispatch.repository.js";
import { isSafetyReviewFlag } from "../orders/order-review-flag.repository.js";
import { untouchedShippingExpiryApplies } from "./shipping-state.repository.js";
import { BostaProviderError } from "./bosta/bosta-client.js";
import { bostaDeliveryProviderFromEnvironment, type DeliveryProvider, type DeliveryRequest, type DeliveryResult } from "./bosta/bosta-delivery.service.js";

type Job = typeof shippingWorkItems.$inferSelect;
type ShippingDispatchTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MAX_ATTEMPTS = 8;
const backoff = (attempt: number) => Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));
const blocked = (order: typeof orders.$inferSelect) => order.paymentStatus === "denied" || order.cancellationStatus !== null || order.refundedAmountCents > 0 ||
  (order.paymentMethod === "paymob" && (order.paymentStatus !== "accepted" || order.providerPaymentStatus !== "succeeded"));

/**
 * The checkout session an order was paid through, if any. Plain reads only, no lock: the
 * order row is already locked by the caller and this must not add a payment-side lock
 * edge. COD and staff-created orders have no session, hence no financial evidence, and
 * return -1 so the guard finds nothing.
 */
async function sessionIdForOrder(tx: ShippingDispatchTransaction, orderId: number): Promise<number> {
  const [order] = await tx.select({ attemptId: orders.paymentAttemptId })
    .from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order?.attemptId) return -1;
  const [attempt] = await tx.select({ sessionId: paymentAttempts.checkoutSessionId })
    .from(paymentAttempts).where(eq(paymentAttempts.id, order.attemptId)).limit(1);
  return attempt?.sessionId ?? -1;
}

async function claim(provider: DeliveryProvider, now: Date, leaseMs: number) {
  const expiredLease = new Date(now.getTime() - leaseMs);
  const [candidate] = await db.select().from(shippingWorkItems).where(and(
    eq(shippingWorkItems.operation, "create_delivery"),
    or(and(eq(shippingWorkItems.status, "pending"), lte(shippingWorkItems.nextAttemptAt, now),
      provider.canCreate ? undefined : eq(shippingWorkItems.id, -1)),
      and(eq(shippingWorkItems.status, "processing"), or(isNull(shippingWorkItems.claimedAt), lte(shippingWorkItems.claimedAt, expiredLease))),
      and(eq(shippingWorkItems.status, "review_required"), eq(shippingWorkItems.lastError, "CREATE_UNCERTAIN"), lte(shippingWorkItems.nextAttemptAt, now)))
  )).orderBy(asc(shippingWorkItems.id)).limit(1);
  if (!candidate) return null;
  return db.transaction(async tx => {
    // Consistent order -> work lock order across claims, rejection and refund callbacks.
    const [order] = await tx.select().from(orders).where(eq(orders.id, candidate.orderId)).limit(1).for("update");
    const [job] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, candidate.id)).limit(1).for("update");
    if (!order || !job) return null;
    const recovering = (job.status === "processing" && (!job.claimedAt || job.claimedAt <= expiredLease)) ||
      (job.status === "review_required" && job.lastError === "CREATE_UNCERTAIN" && job.nextAttemptAt <= now);
    if (!recovering && (job.status !== "pending" || job.nextAttemptAt > now)) return null;
    const stop = async (code: string, possiblySent = true) => {
      await tx.update(shippingWorkItems).set({ status: possiblySent ? "review_required" : "failed", lastError: code, claimedBy: null, claimedAt: null })
        .where(eq(shippingWorkItems.id, job.id));
      await flagShippingOrder(tx, order.id, possiblySent ? "custody_review" : "address_review", code);
      return null;
    };
    const [existing] = await tx.select().from(shipments).where(and(eq(shipments.orderId, order.id), eq(shipments.kind, "outgoing"))).limit(1);
    if (existing) {
      if (existing.idempotencyKey !== job.idempotencyKey) return stop("EXISTING_DELIVERY_MISMATCH");
      await tx.update(shippingWorkItems).set({ status: "succeeded", claimedBy: null, claimedAt: null }).where(eq(shippingWorkItems.id, job.id));
      return null;
    }
    // A crashed final attempt still needs one read-only reconciliation; never create again at the limit.
    if (!recovering && job.attemptCount >= MAX_ATTEMPTS) return stop("ATTEMPT_LIMIT_REVIEW", false);
    if (!recovering) {
      const flags = await tx.select({ flagType: orderReviewFlags.flagType }).from(orderReviewFlags).where(and(
        eq(orderReviewFlags.orderId, order.id), eq(orderReviewFlags.status, "open")));
      // O12: an untouched paid order is only alerted, never held — the deadline still denies
      // COD, but a paid order keeps shipping and is handled by staff through the normal flow.
      const deadlineBlocks = order.paymentMethod === "cod" && order.codExpiresAt != null &&
        order.codExpiresAt <= now && untouchedShippingExpiryApplies(order);
      const safetyFlagOpen = flags.some((flag) => isSafetyReviewFlag(flag.flagType));
      // P04/W06: a refund callback that is durably received but not yet resolved must hold
      // the shipment. Creating a delivery now could send goods to a customer whose money is
      // being returned, who could then spend the refund a second time.
      //
      // The evidence set is scoped to THIS order's own provider order ids rather than a
      // global inbox scan, so an unrelated backlog can neither hide a real refund nor
      // decide this order's fate.
      //
      // Every attempt of the session is consulted, not only the open ones. A refund
      // normally lands hours or days AFTER the payment it reverses, by which point the
      // attempt is long 'succeeded' - scoping this to created/pending missed exactly the
      // case that matters most and shipped goods to customers being refunded.
      //
      // This consults the shared evidence check, which is deliberately lock-free (W06
      // problem 2). That is what makes it safe to call here: the order lock is held, and
      // adding a payment-side lock at this point would complete the session/order cycle.
      // The cost is that this is a point-in-time read, so a refund arriving moments later is
      // caught by blockRefundedDelivery on the order lock instead.
      const sessionId = await sessionIdForOrder(tx, order.id);
      const unresolvedRefund = await hasUnresolvedFinancialEvidence(
        tx, sessionId, await unresolvedInboxOrderIds(await sessionPaymobOrderIds(tx, sessionId), { tx }));
      if (unresolvedRefund) {
        // A TEMPORARY hold, not a failure. Writing `failed` stranded the order until a
        // member of staff pressed retry by hand, and the projections treat this error as an
        // expected stop, so nothing surfaced the stranded order as needing attention. The
        // job stays pending on a backoff and dispatches by itself once the refund resolves.
        await tx.update(shippingWorkItems).set({ status: "pending", claimedBy: null, claimedAt: null,
          lastError: "AWAITING_PAYMENT_EVIDENCE", nextAttemptAt: new Date(now.getTime() + 60_000) })
          .where(eq(shippingWorkItems.id, job.id));
        return null;
      }
      if (blocked(order) || deadlineBlocks || safetyFlagOpen) {
        await tx.update(shippingWorkItems).set({ status: "failed", lastError: "ORDER_NOT_DISPATCHABLE" }).where(eq(shippingWorkItems.id, job.id));
        return null;
      }
    }
    let request: DeliveryRequest;
    try {
      if (job.requestSnapshot) request = JSON.parse(job.requestSnapshot) as DeliveryRequest;
      else {
        // An expired claim without its saved request cannot be safely correlated or resent.
        if (recovering) return stop("MISSING_REQUEST_REVIEW");
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id));
        request = provider.buildRequest(order, items, job.idempotencyKey);
      }
      if (request.accountId !== provider.accountId || request.environment !== provider.environment ||
        request.payload.businessReference !== job.idempotencyKey) return stop("ACCOUNT_OR_REQUEST_CHANGED", recovering);
    } catch { return stop("REQUEST_SNAPSHOT_INVALID", recovering); }
    const claimedBy = randomUUID();
    const attemptCount = Math.min(MAX_ATTEMPTS, job.attemptCount + 1);
    await tx.update(shippingWorkItems).set({ status: "processing", attemptCount,
      claimedBy, claimedAt: now, requestSnapshot: JSON.stringify(request) }).where(eq(shippingWorkItems.id, job.id));
    return { job: { ...job, attemptCount, claimedBy }, request, recovering };
  });
}

async function complete(job: Job, result: DeliveryResult) {
  // Persist the provider result before linking, so a failed final transaction can recover it.
  await db.update(shippingWorkItems).set({ responseSnapshot: JSON.stringify(result) })
    .where(and(eq(shippingWorkItems.id, job.id), isNull(shippingWorkItems.responseSnapshot)));
  await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
    const [current] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, job.id)).limit(1).for("update");
    if (!order || !current) throw new Error("Delivery order/work is missing");
    const saved = JSON.parse(current.responseSnapshot!) as DeliveryResult;
    if (saved.trackingNumber !== result.trackingNumber) {
      await flagShippingOrder(tx, order.id, "custody_review", "Multiple delivery outcomes require staff reconciliation");
      await tx.update(shippingWorkItems).set({ status: "review_required", lastError: "CONFLICTING_DELIVERY_OUTCOMES" }).where(eq(shippingWorkItems.id, job.id));
      return;
    }
    const existing = await tx.select().from(shipments).where(or(eq(shipments.idempotencyKey, job.idempotencyKey), eq(shipments.trackingNumber, result.trackingNumber))).limit(1);
    if (existing.length && (existing[0].orderId !== order.id || existing[0].trackingNumber !== result.trackingNumber)) {
      await flagShippingOrder(tx, order.id, "custody_review", "Delivery tracking belongs to another outcome");
      await tx.update(shippingWorkItems).set({ status: "review_required", lastError: "TRACKING_CONFLICT" }).where(eq(shippingWorkItems.id, job.id));
      return;
    }
    if (!existing.length) await tx.insert(shipments).values({ orderId: order.id, kind: "outgoing", provider: "bosta",
      trackingNumber: result.trackingNumber, rawProviderState: result.rawProviderState, rawProviderCode: result.rawProviderCode,
      normalizedState: result.rawProviderCode === 10 ? "created" : "exception", shippingAmountCents: order.shippingAmountCents,
      manualState: order.manualShippingState,
      size: order.shippingSize!, idempotencyKey: job.idempotencyKey });
    await tx.update(shippingWorkItems).set({ status: "succeeded", lastError: null, claimedBy: null, claimedAt: null })
      .where(eq(shippingWorkItems.id, job.id));
    if (blocked(order)) await flagShippingOrder(tx, order.id,
      order.paymentStatus === "denied" || order.cancellationStatus !== null || order.refundedAmountCents === Math.round(Number(order.totalAmount) * 100)
        ? "cancellation_pending" : "refund_review", "Late delivery outcome after rejection/refund; verify carrier outcome and custody before restocking");
  });
}

async function fail(job: Job, now: Date, mode: "throttled" | "definitive" | "uncertain") {
  await db.transaction(async tx => {
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, job.orderId)).limit(1).for("update");
    const [current] = await tx.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, job.id)).limit(1).for("update");
    if (!current || current.claimedBy !== job.claimedBy || current.status !== "processing") return;
    const exhausted = job.attemptCount >= MAX_ATTEMPTS;
    await tx.update(shippingWorkItems).set({
      status: mode === "throttled" && !exhausted ? "pending" : mode === "definitive" ? "failed" : "review_required",
      lastError: mode === "throttled" ? exhausted ? "ATTEMPT_LIMIT_REVIEW" : "CREATE_THROTTLED"
        : mode === "definitive" ? "CREATE_REJECTED" : exhausted ? "ATTEMPT_LIMIT_REVIEW" : "CREATE_UNCERTAIN",
      nextAttemptAt: new Date(now.getTime() + backoff(job.attemptCount)), claimedBy: null, claimedAt: null
    }).where(eq(shippingWorkItems.id, job.id));
    if (mode !== "throttled" || exhausted) await flagShippingOrder(tx, job.orderId,
      mode === "definitive" ? "address_review" : "custody_review",
      mode === "definitive" ? "Delivery rejected; order retained for staff correction" : "Delivery outcome is uncertain; do not resend or restock without reconciliation");
  });
}

export async function runShippingDispatchOnce(options: { provider?: DeliveryProvider | null; now?: Date; leaseMs?: number } = {}): Promise<boolean> {
  // Saved success needs no carrier call, credentials or additional attempt allocation.
  const [saved] = await db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.operation, "create_delivery"),
    isNotNull(shippingWorkItems.responseSnapshot), or(eq(shippingWorkItems.status, "processing"), eq(shippingWorkItems.status, "pending"), eq(shippingWorkItems.status, "failed"),
      and(eq(shippingWorkItems.status, "review_required"), eq(shippingWorkItems.lastError, "CREATE_UNCERTAIN")))))
    .orderBy(asc(shippingWorkItems.id)).limit(1);
  if (saved) { await complete(saved, JSON.parse(saved.responseSnapshot!) as DeliveryResult); return true; }
  const provider = options.provider === undefined ? bostaDeliveryProviderFromEnvironment(process.env, fetch, { recoveryOnly: true }) : options.provider;
  if (!provider) return false;
  const now = options.now ?? new Date();
  const claimed = await claim(provider, now, options.leaseMs ?? 120_000);
  if (!claimed) return false;
  const { job, request, recovering } = claimed;
  if (job.responseSnapshot) {
    await complete(job, JSON.parse(job.responseSnapshot) as DeliveryResult);
    return true;
  }
  if (recovering) {
    try {
      const found = await provider.reconcile(request);
      if (found) await complete(job, found); else await fail(job, now, "uncertain");
    } catch { await fail(job, now, "uncertain"); }
    return true;
  }
  let result: DeliveryResult;
  try { result = await provider.create(request); }
  catch (error) {
    if (error instanceof BostaProviderError && error.kind === "throttled") await fail(job, now, "throttled");
    else if (error instanceof BostaProviderError && error.kind === "definitive") await fail(job, now, "definitive");
    else {
      try {
        const found = await provider.reconcile(request);
        if (found) { await complete(job, found); return true; }
      } catch { /* No proven outcome: retain stock and only retry reads. */ }
      await fail(job, now, "uncertain");
    }
    return true;
  }
  await complete(job, result);
  return true;
}

export function startShippingDispatchWorker(options: { intervalMs?: number } = {}): () => Promise<void> {
  return startIntervalWorker(async (isStopped) => {
    for (let count = 0; count < 10 && !isStopped(); count++) if (!await runShippingDispatchOnce()) break;
  }, options.intervalMs ?? 30_000,
  () => console.error("Shipping dispatch needs attention; configuration or database operation failed"));
}
