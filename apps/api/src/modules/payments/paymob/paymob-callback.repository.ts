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
