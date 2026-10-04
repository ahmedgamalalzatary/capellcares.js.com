import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts } from "@capella/database/drizzle/schema";
import { hasUnresolvedFinancialEvidence, sessionPaymobOrderIds, unresolvedInboxOrderIds } from "../../checkout/financial-evidence.repository.js";

/** How long one worker may hold a reconciliation claim before another may take it over. */
export const RECONCILE_LEASE_MS = 120_000;
/** How many candidates one sweep may examine; keeps the number of provider reads bounded. */
export const RECONCILE_BATCH_SIZE = 25;
/** Bounded retries before an unresolved inquiry becomes visible staff work instead of an endless silent hold. */
export const RECONCILE_MAX_ATTEMPTS = 8;

export type ReconcileClaim = {
  attemptId: number;
  checkoutSessionId: number;
  paymobOrderId: string;
  claimedBy: string;
  /** Retries already spent on this attempt. */
  attempts: number;
};

/** Candidate attempts for a missed-callback inquiry, discovered WITHOUT locks: an open attempt that holds a provider order id, whose own reservation has expired, with no durable callback evidence and no active claim or pending retry. Discovery is bounded; every candidate is rechecked under its own lock by `claimReconcileAttempt`, so a stale discovery result is simply skipped. */
export async function discoverDueReconcileAttemptIds(now: Date, limit = RECONCILE_BATCH_SIZE): Promise<number[]> {
  const claimExpired = new Date(now.getTime() - RECONCILE_LEASE_MS);
  const rows = await db.select({ id: paymentAttempts.id })
    .from(paymentAttempts)
    .innerJoin(checkoutSessions, eq(checkoutSessions.id, paymentAttempts.checkoutSessionId))
    .where(and(
      inArray(paymentAttempts.status, ["created", "pending"]),
      isNotNull(paymentAttempts.paymobOrderId),
      eq(checkoutSessions.state, "payment_pending"),
      lte(checkoutSessions.reservationExpiresAt, now),
      or(isNull(paymentAttempts.reconcileNextAt), lte(paymentAttempts.reconcileNextAt, now)),
      or(isNull(paymentAttempts.reconcileClaimedAt), lte(paymentAttempts.reconcileClaimedAt, claimExpired))
    ))
    .orderBy(asc(checkoutSessions.reservationExpiresAt), asc(paymentAttempts.id))
    .limit(limit);
  return rows.map((row) => row.id);
}

/** Takes the lease on one candidate under its row lock. Returns null when the attempt is no longer eligible, is already claimed, or already has durably-received callback evidence — that receipt is the callback worker's to resolve, and inquiring in parallel could race the settlement it is about to apply. */
export async function claimReconcileAttempt(
  attemptId: number,
  now: Date,
  leaseMs = RECONCILE_LEASE_MS
): Promise<ReconcileClaim | null> {
  const claimExpired = new Date(now.getTime() - leaseMs);
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, attemptId)).for("update");
    if (!row || (row.status !== "created" && row.status !== "pending") || row.paymobOrderId === null) return null;
    if (row.reconcileNextAt !== null && row.reconcileNextAt.getTime() > now.getTime()) return null;
    if (row.reconcileClaimedAt !== null && row.reconcileClaimedAt.getTime() > claimExpired.getTime()) return null;
    const unresolvedOrderIds = await unresolvedInboxOrderIds(await sessionPaymobOrderIds(tx, row.checkoutSessionId), { tx });
    if (await hasUnresolvedFinancialEvidence(tx, row.checkoutSessionId, unresolvedOrderIds)) return null;
    const claimedBy = randomUUID();
    await tx.update(paymentAttempts).set({ reconcileClaimedAt: now, reconcileClaimedBy: claimedBy })
      .where(eq(paymentAttempts.id, row.id));
    return { attemptId: row.id, checkoutSessionId: row.checkoutSessionId, paymobOrderId: String(row.paymobOrderId),
      claimedBy, attempts: row.reconcileAttempts };
  });
}

export type ReconcileOutcome =
  /** Settlement applied a proven success; only the reconciliation bookkeeping remains to clear. */
  | { kind: "recovered" }
  /** The provider proved nothing was paid; the attempt resolves so ordinary expiry can release it. */
  | { kind: "no_payment"; reason: string }
  /** Still unresolved but retryable; schedule a bounded retry and keep the stock held. */
  | { kind: "retry"; reason: string; nextAt: Date }
  /** Retries exhausted; park for staff, visible in ERP, keeping the hold rather than releasing a guess. */
  | { kind: "park"; reason: string };

/** Writes a reconciliation outcome, but only for the worker that still holds the live claim — a lease that was taken over by another sweep cannot publish its stale result. */
export async function applyReconcileOutcome(claim: ReconcileClaim, outcome: ReconcileOutcome, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, claim.attemptId)).for("update");
    if (!row || row.reconcileClaimedBy !== claim.claimedBy) return;
    if (outcome.kind === "recovered") {
      await tx.update(paymentAttempts).set({ reconcileNextAt: null, reconcileClaimedAt: null,
        reconcileClaimedBy: null, reconcileLastError: "RECOVERED_BY_INQUIRY" }).where(eq(paymentAttempts.id, row.id));
      return;
    }
    if (outcome.kind === "no_payment") {
      await tx.update(paymentAttempts).set({ status: "failed", failureCode: "PAYMENT_INQUIRY_NO_PAYMENT",
        reconcileNextAt: null, reconcileClaimedAt: null, reconcileClaimedBy: null, reconcileLastError: outcome.reason })
        .where(and(eq(paymentAttempts.id, row.id), inArray(paymentAttempts.status, ["created", "pending"])));
      return;
    }
    const attempts = row.reconcileAttempts + 1;
    if (outcome.kind === "retry") {
      await tx.update(paymentAttempts).set({ reconcileAttempts: attempts, reconcileNextAt: outcome.nextAt,
        reconcileClaimedAt: null, reconcileClaimedBy: null, reconcileLastError: outcome.reason })
        .where(eq(paymentAttempts.id, row.id));
      return;
    }
    await tx.update(paymentAttempts).set({ status: "reconciliation_required", failureCode: "PAYMENT_INQUIRY_UNRESOLVED",
      reconcileAttempts: attempts, reconcileNextAt: now, reconcileClaimedAt: null, reconcileClaimedBy: null,
      reconcileLastError: outcome.reason })
      .where(and(eq(paymentAttempts.id, row.id), inArray(paymentAttempts.status, ["created", "pending"])));
  });
}
