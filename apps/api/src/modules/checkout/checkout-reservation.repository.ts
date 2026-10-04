import { and, eq, gt, gte, inArray, lte, notExists, or, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, paymentAttempts, paymobCallbackInbox, productVariants } from "@capella/database/drizzle/schema";
import { UNRESOLVED_INBOX_STATUSES, hasUnresolvedFinancialEvidence, sessionPaymobOrderIds, unresolvedInboxOrderIds } from "./financial-evidence.repository.js";
import { sqlReceiptHoldsStock } from "./receipt-hold-policy.js";

interface ReservedCheckoutInput {
  publicId: string;
  idempotencyKey: string;
  customerType: "guest" | "registered";
  customerId: number | null;
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes: string;
  cartSnapshot: string;
  amountCents: number;
  shippingAmountCents?: number;
  shippingSnapshot?: string | null;
  reservationExpiresAt: Date;
  reservations: Array<{ variantId: number; qty: number }>;
  initialAttempt?: {
    merchantReference: string;
    environment: "test" | "live";
    allowedIntegrationIds: number[];
    expiresAt: Date;
  };
}

export async function createReservedCheckout(input: ReservedCheckoutInput) {
  return db.transaction(async (tx) => {
    const [session] = await tx.insert(checkoutSessions).values({
      publicId: input.publicId,
      idempotencyKey: input.idempotencyKey,
      customerType: input.customerType,
      customerId: input.customerId,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      governorate: input.governorate,
      cityArea: input.cityArea,
      addressLine: input.addressLine,
      buildingApartment: input.buildingApartment,
      notes: input.notes,
      cartSnapshot: input.cartSnapshot,
      amountCents: input.amountCents,
      shippingAmountCents: input.shippingAmountCents ?? 0,
      shippingSnapshot: input.shippingSnapshot ?? null,
      currency: "EGP",
      state: "payment_pending",
      attemptCount: input.initialAttempt ? 1 : 0,
      reservationExpiresAt: input.reservationExpiresAt
    }).$returningId();

    for (const reservation of input.reservations) {
      const result = await tx.update(productVariants)
        .set({ stockQty: sql`${productVariants.stockQty} - ${reservation.qty}` })
        .where(and(
          eq(productVariants.id, reservation.variantId),
          gte(productVariants.stockQty, reservation.qty)
        ));
      if (result[0].affectedRows !== 1) throw new Error("Insufficient stock");
      await tx.insert(checkoutReservations).values({
        checkoutSessionId: session.id,
        variantId: reservation.variantId,
        qty: reservation.qty,
        state: "reserved"
      });
    }

    let paymentAttemptId: number | null = null;
    if (input.initialAttempt) {
      const [attempt] = await tx.insert(paymentAttempts).values({
        checkoutSessionId: session.id,
        attemptNumber: 1,
        merchantReference: input.initialAttempt.merchantReference,
        amountCents: input.amountCents,
        currency: "EGP",
        environment: input.initialAttempt.environment,
        allowedIntegrationIds: JSON.stringify(input.initialAttempt.allowedIntegrationIds),
        status: "created",
        expiresAt: input.initialAttempt.expiresAt
      }).$returningId();
      paymentAttemptId = attempt.id;
    }

    return { id: session.id, publicId: input.publicId, paymentAttemptId };
  });
}

/** How many expired sessions one sweep may examine. Keeps lock hold time bounded. */
export const EXPIRY_BATCH_SIZE = 50;

/** Candidate ids for expiry, discovered WITHOUT any locks. The previous implementation ran a locking range scan over every expired session and held those row locks until the whole sweep finished, so one slow pass could block customers paying at that moment; discovery is now a cheap unlocked read of a bounded batch and each candidate is locked and rechecked on its own. */
export async function discoverExpiredSessionIds(now: Date, limit = EXPIRY_BATCH_SIZE): Promise<number[]> {
  // Candidates are the expired sessions whose provider order ids are NOT already sitting in unresolved evidence. Sessions that are only HELD must not consume a discovery slot — they are skipped under their own lock anyway, so counting them means a run of held sessions can fill the whole batch and the eligible sessions behind them are never examined (stock never released, sweep stops progressing); exclude held sessions BEFORE limiting, since any finite oversample can be filled by held rows.
  const evidence = db.select({ id: paymobCallbackInbox.id }).from(paymentAttempts)
    .innerJoin(paymobCallbackInbox, or(
      eq(paymobCallbackInbox.signedOrderId, paymentAttempts.paymobOrderId),
      // Upgrade-window fallback: signed_order_id is NULL for every row predating migration 0063 until the backfill runs, so joining on the scalar alone would exclude those rows and a paid checkout would look unevidenced and expiry would release its stock.
      sql`json_unquote(json_extract(${paymobCallbackInbox.normalizedPayload}, '$.order.id')) = ${paymentAttempts.paymobOrderId}`))
    .where(and(eq(paymentAttempts.checkoutSessionId, checkoutSessions.id),
      sql`${paymobCallbackInbox.processingStatus} in (${sql.join(UNRESOLVED_INBOX_STATUSES.map(status => sql`${status}`), sql`, `)})`,
      // The SAME policy the per-candidate recheck uses under the session lock. Discovery previously re-implemented "is this receipt actionable" with a JSON extraction and no classification, so it treated a parked decline as a hold while the recheck treated it as none — the sweep could exclude every eligible session and release nothing; one definition, used by both.
      sqlReceiptHoldsStock(paymobCallbackInbox.normalizedPayload)));
  const candidates = await db.select({ id: checkoutSessions.id })
    .from(checkoutSessions)
    .where(and(
      eq(checkoutSessions.state, "payment_pending"),
      lte(checkoutSessions.reservationExpiresAt, now),
      notExists(evidence)
    ))
    .orderBy(checkoutSessions.reservationExpiresAt)
    .limit(limit);
  return candidates.map(candidate => candidate.id);
}

export async function releaseExpiredCheckoutReservations(
  now: Date,
  options: { isStopped?: () => boolean } = {}
): Promise<void> {
  // Pass 1: cheap unlocked discovery of a bounded candidate set.
  const candidates = await discoverExpiredSessionIds(now);
  if (candidates.length === 0) return;

  // Pass 2: one short transaction per candidate, so no lock is held across the batch.
  for (const sessionId of candidates) {
    // A stop request during a long backlog must not wait for every remaining candidate. Checked before each record, so the in-flight one is completed and the rest are left recoverable for the next run.
    if (options.isStopped?.()) return;
    await db.transaction(async (tx) => {
      // Recheck under the session lock: the row may have changed since discovery, in which case it is simply skipped and the next sweep re-evaluates it against fresh data.
      const [session] = await tx.select({ id: checkoutSessions.id, state: checkoutSessions.state,
        expiresAt: checkoutSessions.reservationExpiresAt })
        .from(checkoutSessions)
        .where(and(
          eq(checkoutSessions.id, sessionId),
          eq(checkoutSessions.state, "payment_pending"),
          lte(checkoutSessions.reservationExpiresAt, now)
        ))
        .for("update");
      if (!session) return;

      // Take a fresh snapshot after acquiring the shared intake/session lock. Use this transaction's connection, not a second pool connection under locks.
      const unresolvedOrderIds = await unresolvedInboxOrderIds(await sessionPaymobOrderIds(tx, sessionId), { tx });

      // P03: a verified callback may already be durably received while its effects are still queued — releasing the reservation then would free stock the customer has already paid for and leave the eventual success with nothing to fulfil.
      if (await hasUnresolvedFinancialEvidence(tx, session.id, unresolvedOrderIds)) return;
      const reservations = await tx.select()
        .from(checkoutReservations)
        .where(and(
          eq(checkoutReservations.checkoutSessionId, session.id),
          eq(checkoutReservations.state, "reserved")
        ))
        .for("update");
      for (const reservation of reservations) {
        await tx.update(productVariants)
          .set({ stockQty: sql`${productVariants.stockQty} + ${reservation.qty}` })
          .where(eq(productVariants.id, reservation.variantId));
        await tx.update(checkoutReservations)
          .set({ state: "released" })
          .where(eq(checkoutReservations.id, reservation.id));
      }
      await tx.update(paymentAttempts)
        .set({ status: "reconciliation_required", failureCode: "EARLY_REFUND_EXPIRED" })
        .where(and(eq(paymentAttempts.checkoutSessionId, session.id),
          gt(paymentAttempts.earlyRefundAmountCents, 0)));
      await tx.update(paymentAttempts)
        .set({ status: "expired", failureCode: "RESERVATION_EXPIRED" })
        .where(and(eq(paymentAttempts.checkoutSessionId, session.id),
          eq(paymentAttempts.earlyRefundAmountCents, 0),
          inArray(paymentAttempts.status, ["created", "pending"])));
      await tx.update(checkoutSessions)
        .set({ state: "expired" })
        .where(eq(checkoutSessions.id, session.id));
    });
  }
}
