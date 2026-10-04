import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { paymobCallbackInbox } from "@capella/database/drizzle/schema";

export const PAYMOB_CALLBACK_LEASE_MS = 120_000;
export type PaymobCallbackClaim = typeof paymobCallbackInbox.$inferSelect & { claimedBy: string };

export async function claimPaymobCallback(options: { id?: number; now?: Date } = {}): Promise<PaymobCallbackClaim | null> {
  const now = options.now ?? new Date();
  const expired = new Date(now.getTime() - PAYMOB_CALLBACK_LEASE_MS);
  const [candidate] = await db.select({ id: paymobCallbackInbox.id }).from(paymobCallbackInbox).where(and(
    options.id === undefined ? undefined : eq(paymobCallbackInbox.id, options.id),
    or(eq(paymobCallbackInbox.processingStatus, "received"),
      and(eq(paymobCallbackInbox.processingStatus, "failed"), lte(paymobCallbackInbox.nextAttemptAt, now)),
      and(eq(paymobCallbackInbox.processingStatus, "processing"),
        or(isNull(paymobCallbackInbox.claimedAt), lte(paymobCallbackInbox.claimedAt, expired))))
  )).orderBy(asc(paymobCallbackInbox.nextAttemptAt), asc(paymobCallbackInbox.id)).limit(1);
  if (!candidate) return null;
  return db.transaction(async tx => {
    const [row] = await tx.select().from(paymobCallbackInbox).where(eq(paymobCallbackInbox.id, candidate.id)).for("update");
    if (!row || !(row.processingStatus === "received" || (row.processingStatus === "failed" && row.nextAttemptAt <= now) ||
      (row.processingStatus === "processing" && (!row.claimedAt || row.claimedAt <= expired)))) return null;
    const claimedBy = randomUUID();
    const attempts = row.attempts + 1;
    await tx.update(paymobCallbackInbox).set({ processingStatus: "processing", claimedBy, claimedAt: now, attempts })
      .where(eq(paymobCallbackInbox.id, row.id));
    return { ...row, processingStatus: "processing", claimedBy, claimedAt: now, attempts };
  });
}

export async function deferPaymobCallback(claim: PaymobCallbackClaim, reason: string, now: Date) {
  const binding = reason === "PAYMENT_BINDING_UNRESOLVED";
  const review = binding ? now.getTime() - claim.receivedAt.getTime() >= 15 * 60_000 : claim.attempts >= 8;
  await db.update(paymobCallbackInbox).set({ processingStatus: review ? "review_required" : "failed",
    lastError: reason, claimedBy: null, claimedAt: null, processedAt: null,
    nextAttemptAt: new Date(now.getTime() + Math.min(60_000, 2000 * 2 ** Math.min(5, claim.attempts - 1)))
  }).where(and(eq(paymobCallbackInbox.id, claim.id), eq(paymobCallbackInbox.processingStatus, "processing"),
    eq(paymobCallbackInbox.claimedBy, claim.claimedBy)));
}

export async function rejectPaymobCallback(claim: PaymobCallbackClaim, reason: string, now: Date) {
  await db.update(paymobCallbackInbox).set({ processingStatus: "rejected", lastError: reason,
    processedAt: now, claimedBy: null, claimedAt: null }).where(and(eq(paymobCallbackInbox.id, claim.id),
    eq(paymobCallbackInbox.processingStatus, "processing"), eq(paymobCallbackInbox.claimedBy, claim.claimedBy)));
}

/**
 * Staff recovery for a parked callback. Offers the SAME durably stored receipt to the
 * idempotent processor again; it never fabricates provider evidence and never bypasses the
 * processor's own authentication/verification, so a resend of an uncertain mutation is
 * still reconciled through verified reads. Only a parked row may be requeued; `attempts`
 * resets so the retry gets a fresh bounded window instead of re-parking on the first try.
 */
export async function requeuePaymobCallback(id: number, now: Date): Promise<"requeued" | "not_parked" | "missing"> {
  return db.transaction(async tx => {
    const [row] = await tx.select({ status: paymobCallbackInbox.processingStatus })
      .from(paymobCallbackInbox).where(eq(paymobCallbackInbox.id, id)).for("update");
    if (!row) return "missing";
    if (row.status !== "review_required" && row.status !== "failed") return "not_parked";
    await tx.update(paymobCallbackInbox).set({ processingStatus: "received", lastError: null,
      claimedBy: null, claimedAt: null, processedAt: null, attempts: 0, nextAttemptAt: now })
      .where(eq(paymobCallbackInbox.id, id));
    return "requeued";
  });
}
