import { and, eq, lt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@capella/database/src/db";
import { carts, checkoutReservations, checkoutSessions, orderItems, orders, paymentAttempts, paymentWebhookEvents, paymobCallbackInbox, productVariants } from "@capella/database/drizzle/schema";
import { generateOrderCode, generatePendingOrderCode, UNTOUCHED_EXPIRY_MS } from "../../orders/order/shared.js";
import { checkoutShippingQuoteSchema } from "@capella/shared";
import { enqueueOrderDelivery, blockRefundedDelivery } from "../../shipping/shipping-dispatch.repository.js";
import { hasUnresolvedFinancialEvidence, sessionPaymobOrderIds, unresolvedInboxOrderIds } from "../../checkout/financial-evidence.repository.js";

type PaymobTransaction = Record<string, any> & {
  order?: { id?: unknown; merchant_order_id?: unknown };
  source_data?: { type?: unknown };
};

/** Authenticated provider state for a callback, supplied by the caller after a trusted inquiry read.
 * It exists because `refunded_amount_cents` is NOT in Paymob's HMAC input list, so the callback's copy is attacker-controllable — every refund amount here comes from `verified`, never the callback body, and a callback with no verified read cannot assert a refund amount at all. `environment` (the authenticated read's own `is_live`) is an additional cross-check that must agree with the local attempt, never a substitute for it. */
type VerifiedPaymobState = {
  is_refunded?: boolean;
  refunded_amount_cents?: number | null;
  environment?: "test" | "live";
};

function isDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === "ER_DUP_ENTRY" || candidate.cause?.code === "ER_DUP_ENTRY";
}

export type ProcessPaymobOptions = {
  /** Trusted state from `queryPaymobTransaction`. Without it, no refund amount is trusted. */
  verified?: VerifiedPaymobState;
  /** When supplied, the audit outcome is written inside this same transaction instead of a separate follow-up call, so the order and its recorded outcome commit together — a crash can no longer leave a paid order with no audit trail, nor an audit row claiming a payment that rolled back. */
  audit?: { transaction: Record<string, unknown> };
  inbox?: { id: number; claimedBy: string; now: Date; leaseMs: number };
};

/** Audit identity for a callback. Deliberately excludes the CALLBACK's `refunded_amount_cents` (not HMAC-covered, so an unsigned value must not collapse two genuinely different callbacks into one audit row) and `is_live` (also unsigned — including it let anyone holding one validly signed callback replay it with the flag flipped to mint unlimited distinct receipts/audit rows and assert an environment the signature never protected).
 * The VERIFIED refund amount IS included: a partial refund followed by a larger one are two distinct real-world events, and leaving it out discarded the second and lost the fact the refund had grown. */
export function paymobAuditFingerprint(transaction: Record<string, unknown>, verified?: VerifiedPaymobState): {
  eventFingerprint: string; processingStatus: "processed" | "rejected";
} {
  const identity = JSON.stringify({
    id: transaction.id,
    order_id: (transaction.order as { id?: unknown } | undefined)?.id,
    integration_id: transaction.integration_id,
    success: transaction.success,
    pending: transaction.pending,
    is_auth: transaction.is_auth,
    is_capture: transaction.is_capture,
    is_refunded: transaction.is_refunded,
    is_voided: transaction.is_voided,
    captured_amount: transaction.captured_amount,
    // Trusted value only, so it distinguishes real refund progression without ever letting an unsigned amount steer the audit identity.
    verified_refunded_amount_cents: verified?.is_refunded === true
      ? Number(verified.refunded_amount_cents ?? 0)
      : null
  });
  return { eventFingerprint: createHash("sha256").update(identity).digest("hex"), processingStatus: "processed" };
}

export async function processPaymobTransaction(transaction: PaymobTransaction, options: ProcessPaymobOptions = {}) {
  const verified = options.verified;
  // The refund amount is authoritative only from the authenticated read.
  const refundedAmountCents = verified?.is_refunded === true
    ? Number(verified.refunded_amount_cents ?? 0)
    : 0;
  const [bound] = await db.select({ sessionId: paymentAttempts.checkoutSessionId }).from(paymentAttempts)
    .where(eq(paymentAttempts.paymobOrderId, String(transaction.order?.id ?? ""))).limit(1);
  return db.transaction(async (tx) => {
    // All financial paths serialize on the session before taking attempt/order or inbox locks. Unbound events take only their inbox lock and cannot affect money.
    if (bound) await tx.select({ id: checkoutSessions.id }).from(checkoutSessions)
      .where(eq(checkoutSessions.id, bound.sessionId)).for("update");
    if (options.inbox) {
      const [receipt] = await tx.select().from(paymobCallbackInbox).where(eq(paymobCallbackInbox.id, options.inbox.id)).for("update");
      if (!receipt || receipt.processingStatus !== "processing" || receipt.claimedBy !== options.inbox.claimedBy ||
        !receipt.claimedAt || receipt.claimedAt.getTime() + options.inbox.leaseMs <= options.inbox.now.getTime()) {
        return { outcome: "stale_claim" as const };
      }
    }
    const outcome = bound ? await applyPaymobTransaction(tx, transaction, verified, bound.sessionId, options.inbox?.id)
      : { outcome: "unmatched" as const };
    if (options.audit && outcome.outcome !== "unmatched") {
      // Inside the same transaction: the audit row and the effects it describes share one fate.
      const { eventFingerprint } = paymobAuditFingerprint(options.audit.transaction, verified);
      try {
        await tx.insert(paymentWebhookEvents).values({ provider: "paymob", callbackType: "transaction",
          eventFingerprint, processingStatus: PROCESSED_OUTCOMES.has(outcome.outcome) ? "processed" : "rejected",
          processedAt: new Date() });
      } catch (error) {
        // A redelivered callback has the same fingerprint. That is normal, and must never roll back a legitimate payment just because its audit row already exists.
        if (!isDuplicateEntry(error)) throw error;
      }
    }
    if (options.inbox && outcome.outcome !== "unmatched") {
      await tx.update(paymobCallbackInbox).set({ processingStatus: outcome.outcome === "reconciliation_required"
        ? "review_required" : PROCESSED_OUTCOMES.has(outcome.outcome) ? "processed" : "rejected",
        processedAt: options.inbox.now, claimedBy: null, claimedAt: null,
        lastError: outcome.outcome === "reconciliation_required" ? "PAYMENT_RECONCILIATION_REQUIRED" : null
      }).where(eq(paymobCallbackInbox.id, options.inbox.id));
    }
    return outcome;
  });
}

const PROCESSED_OUTCOMES = new Set(["succeeded", "refunded", "failed", "pending", "refund_pending_success"]);

type PaymobTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function applyPaymobTransaction(tx: PaymobTx, transaction: PaymobTransaction, verified: VerifiedPaymobState | undefined,
  sessionId: number, inboxId?: number) {
  // The refund amount is authoritative only from the authenticated read.
  const refundedAmountCents = verified?.is_refunded === true
    ? Number(verified.refunded_amount_cents ?? 0)
    : 0;
  {
    const [match] = await tx.select({
      attempt: paymentAttempts,
      session: checkoutSessions
    }).from(paymentAttempts)
      .innerJoin(checkoutSessions, eq(checkoutSessions.id, paymentAttempts.checkoutSessionId))
      // Correlation rests ONLY on `order.id`, which is covered by Paymob's HMAC.
      //
      // `order.merchant_order_id` is NOT in the HMAC input list, so it was previously an
      // accepted fallback - which meant anyone holding one validly-signed callback could
      // rewrite that field and have it still verify, settling a checkout they do not own.
      // An attempt whose signed id does not match is unmatched; it is never resolved by an
      // unsigned value.
      .where(and(eq(paymentAttempts.paymobOrderId, String(transaction.order?.id ?? "")), eq(checkoutSessions.id, sessionId)))
      .limit(1)
      .for("update");
    if (!match) return { outcome: "unmatched" as const };

    // The environment is the one recorded on the LOCAL attempt that created the intention.
    // The callback's `is_live` flag is deliberately NOT consulted — it is outside Paymob's HMAC input list, so deriving acceptance from it meant anyone holding one validly signed callback could flip the flag to steer whether the payment was accepted, refunded or held; the locally recorded value is the only one fixed before the provider was called, and when an authenticated inquiry was used its environment must additionally agree.
    const environmentMatches = verified?.environment === undefined
      || match.attempt.environment === verified.environment;
    const allowedIntegrationIds = match.attempt.allowedIntegrationIds
      ? JSON.parse(match.attempt.allowedIntegrationIds) as unknown
      : [match.attempt.integrationId];
    const integrationMatches = Array.isArray(allowedIntegrationIds) &&
      allowedIntegrationIds.includes(Number(transaction.integration_id));
    const baseIdentity =
      transaction.is_auth === false && transaction.is_capture === false &&
      transaction.is_voided === false &&
      transaction.has_parent_transaction === false &&
      Number(transaction.amount_cents) === match.attempt.amountCents &&
      transaction.currency === match.attempt.currency &&
      integrationMatches &&
      environmentMatches;

    if (match.attempt.status === "succeeded" && match.session.createdOrderId) {
      if (transaction.is_refunded === true) {
        // Trusted total only; the callback's own amount is unsigned and ignored.
        const refundedCents = refundedAmountCents;
        if (String(transaction.id) !== match.attempt.paymobTransactionId ||
          Number(transaction.amount_cents) !== match.attempt.amountCents ||
          transaction.currency !== match.attempt.currency ||
          Number(transaction.integration_id) !== match.attempt.integrationId ||
          !environmentMatches ||
          transaction.success !== true || transaction.pending !== false ||
          !Number.isSafeInteger(refundedCents) || refundedCents <= 0 || refundedCents > match.attempt.amountCents) {
          return { outcome: "rejected" as const };
        }
        await tx.update(orders).set({
          refundedAmountCents: refundedCents,
          providerPaymentStatus: refundedCents === match.attempt.amountCents ? "refunded" : "partially_refunded"
        }).where(and(eq(orders.id, match.session.createdOrderId),
          lt(orders.refundedAmountCents, refundedCents)));
        await blockRefundedDelivery(tx, match.session.createdOrderId);
        return { outcome: "refunded" as const, orderId: match.session.createdOrderId };
      }
      if (!baseIdentity || transaction.success !== true || transaction.pending !== false) {
        return { outcome: "rejected" as const };
      }
      if (match.attempt.paymobTransactionId &&
        match.attempt.paymobTransactionId !== String(transaction.id)) {
        // Keep the attempt's canonical succeeded status so later duplicate callbacks and legitimate refunds still flow through the post-success branch; record the second-capture flag separately via failureCode (surfaced by ERP reconciliation).
        await tx.update(paymentAttempts).set({
          failureCode: "SECOND_CAPTURE_AFTER_SUCCESS"
        }).where(eq(paymentAttempts.id, match.attempt.id));
        return { outcome: "reconciliation_required" as const };
      }
      return {
        outcome: "succeeded" as const,
        orderId: match.session.createdOrderId,
        paymentAttemptId: match.attempt.id,
        checkoutSessionId: match.session.id
      };
    }
    if (transaction.is_refunded === true) {
      // Trusted total only; the callback's own amount is unsigned and ignored.
      const refundedCents = refundedAmountCents;
      if (!baseIdentity || transaction.success !== true || transaction.pending !== false ||
        !Number.isSafeInteger(refundedCents) || refundedCents <= 0 || refundedCents > match.attempt.amountCents ||
        (match.attempt.paymobTransactionId && match.attempt.paymobTransactionId !== String(transaction.id)) ||
        (match.attempt.integrationId && match.attempt.integrationId !== Number(transaction.integration_id))) {
        return { outcome: "rejected" as const };
      }
      if (match.session.state !== "payment_pending" ||
        (match.attempt.status !== "pending" && match.attempt.status !== "created")) {
        await tx.update(paymentAttempts).set({
          status: "reconciliation_required", paymobTransactionId: String(transaction.id),
          failureCode: "REFUND_BEFORE_ORDER_AFTER_CHECKOUT_CLOSED"
        }).where(eq(paymentAttempts.id, match.attempt.id));
        return { outcome: "reconciliation_required" as const };
      }
      await tx.update(paymentAttempts).set({
        earlyRefundAmountCents: Math.max(match.attempt.earlyRefundAmountCents, refundedCents),
        paymobTransactionId: String(transaction.id),
        integrationId: Number(transaction.integration_id)
      }).where(eq(paymentAttempts.id, match.attempt.id));
      return { outcome: "refund_pending_success" as const };
    }
    const validIdentity = baseIdentity && transaction.is_refunded === false;
    if (!validIdentity) return { outcome: "rejected" as const };
    if (transaction.pending === true) return { outcome: "pending" as const };
    if (transaction.pending !== false) return { outcome: "rejected" as const };
    if (transaction.success === false) {
      if (match.attempt.earlyRefundAmountCents > 0) return { outcome: "rejected" as const };
      await tx.update(paymentAttempts).set({ status: "failed", paymobTransactionId: String(transaction.id) })
        .where(eq(paymentAttempts.id, match.attempt.id));
      if (match.attempt.attemptNumber === match.session.attemptCount &&
        match.session.attemptCount >= 3 && match.session.state === "payment_pending") {
        // W06 P04: a third decline normally releases the reservation, but not while any attempt of this session still has durably-received, unresolved evidence — a success callback in flight means the customer may already have paid, and releasing now frees that stock and leaves the eventual success with nothing to fulfil.
        // The inbox lookup is lock-free (W06 problem 2), so consulting it adds no payment-side lock edge and cannot form the session/order cycle.
        const unresolvedOrderIds = await unresolvedInboxOrderIds(
          await sessionPaymobOrderIds(tx, match.session.id), { tx, excludeInboxId: inboxId });
        if (!await hasUnresolvedFinancialEvidence(tx, match.session.id, unresolvedOrderIds)) {
          const reservations = await tx.select().from(checkoutReservations)
            .where(and(eq(checkoutReservations.checkoutSessionId, match.session.id),
              eq(checkoutReservations.state, "reserved"))).for("update");
          for (const reservation of reservations) {
            await tx.update(productVariants).set({ stockQty: sql`${productVariants.stockQty} + ${reservation.qty}` })
              .where(eq(productVariants.id, reservation.variantId));
            await tx.update(checkoutReservations).set({ state: "released" })
              .where(eq(checkoutReservations.id, reservation.id));
          }
          await tx.update(checkoutSessions).set({ state: "expired" })
            .where(eq(checkoutSessions.id, match.session.id));
        }
      }
      return { outcome: "failed" as const };
    }
    if (transaction.success !== true) return { outcome: "rejected" as const };
    if (match.attempt.earlyRefundAmountCents > 0 &&
      (match.attempt.paymobTransactionId !== String(transaction.id) ||
        match.attempt.integrationId !== Number(transaction.integration_id))) {
      return { outcome: "rejected" as const };
    }

    const reservations = await tx.select().from(checkoutReservations)
      .where(and(
        eq(checkoutReservations.checkoutSessionId, match.session.id),
        eq(checkoutReservations.state, "reserved")
      )).for("update");
    if (reservations.length === 0) {
      await tx.update(paymentAttempts).set({
        status: "reconciliation_required",
        paymobTransactionId: String(transaction.id),
        failureCode: "PAID_AFTER_RESERVATION_RELEASE"
      }).where(eq(paymentAttempts.id, match.attempt.id));
      return { outcome: "reconciliation_required" as const };
    }

    const snapshot = JSON.parse(match.session.cartSnapshot) as Array<Record<string, any>>;
    if (!Array.isArray(snapshot) || snapshot.length === 0) throw new Error("Checkout snapshot is invalid");
    const shipping = match.session.shippingSnapshot ? checkoutShippingQuoteSchema.parse(JSON.parse(match.session.shippingSnapshot)) : null;
    const productsCents = snapshot.reduce((sum, item) => sum + Math.round(Number(item.lineTotal) * 100), 0);
    if (productsCents + match.session.shippingAmountCents !== match.attempt.amountCents ||
      match.session.amountCents !== match.attempt.amountCents ||
      (shipping && (shipping.amountCents !== match.attempt.amountCents || shipping.productsTotalCents !== productsCents ||
        shipping.shippingAmountCents !== match.session.shippingAmountCents || shipping.paymentMethod !== "paymob" || shipping.codAmountCents !== 0)) ||
      (!shipping && match.session.shippingAmountCents !== 0)) {
      await tx.update(paymentAttempts).set({ status: "reconciliation_required", failureCode: "CHECKOUT_SNAPSHOT_MISMATCH",
        paymobTransactionId: String(transaction.id) }).where(eq(paymentAttempts.id, match.attempt.id));
      return { outcome: "reconciliation_required" as const };
    }
    const [order] = await tx.insert(orders).values({
      orderCode: generatePendingOrderCode(),
      customerType: match.session.customerType,
      customerId: match.session.customerId,
      fullName: match.session.fullName,
      phone: match.session.phone,
      email: match.session.email,
      governorate: match.session.governorate,
      cityArea: match.session.cityArea,
      addressLine: match.session.addressLine,
      buildingApartment: match.session.buildingApartment,
      notes: match.session.notes,
      paymentMethod: "paymob",
      paymentStatus: "accepted",
      providerPaymentStatus: match.attempt.earlyRefundAmountCents === match.attempt.amountCents ? "refunded"
        : match.attempt.earlyRefundAmountCents > 0 ? "partially_refunded" : "succeeded",
      refundedAmountCents: match.attempt.earlyRefundAmountCents,
      paymentAttemptId: match.attempt.id,
      shippingAmountCents: match.session.shippingAmountCents,
      shippingQuoteId: shipping?.quoteId ?? null,
      shippingSize: shipping?.size ?? null,
      shippingSnapshot: match.session.shippingSnapshot,
      // D24: the paid order gets the same fixed 96-hour untouched deadline as COD, so the staff alert for an untouched paid order can actually be raised by the sweep.
      codExpiresAt: new Date(Date.now() + UNTOUCHED_EXPIRY_MS),
      totalAmount: sql`${match.attempt.amountCents / 100}`
    }).$returningId();
    await tx.update(orders).set({ orderCode: generateOrderCode(order.id) }).where(eq(orders.id, order.id));
    await tx.insert(orderItems).values(snapshot.map((item) => ({
      orderId: order.id,
      itemType: item.itemType,
      variantId: item.variantId ?? null,
      offerId: item.offerId ?? null,
      collectionId: item.collectionId ?? null,
      qty: item.qty,
      unitPrice: sql`${item.unitPrice}`,
      lineTotal: sql`${item.lineTotal}`,
      snapshotNameAr: item.snapshotNameAr ?? null,
      snapshotNameEn: item.snapshotNameEn ?? null,
      snapshotSizeLabel: item.snapshotSizeLabel ?? null,
      snapshotComponents: item.snapshotComponents ? JSON.stringify(item.snapshotComponents) : null,
      snapshotBaseUnitPrice: item.snapshotBaseUnitPrice == null ? null : sql`${item.snapshotBaseUnitPrice}`,
      snapshotDiscountId: item.snapshotDiscountId ?? null,
      snapshotDiscountType: item.snapshotDiscountType ?? null,
      snapshotDiscountValue: item.snapshotDiscountValue == null ? null : sql`${item.snapshotDiscountValue}`,
      snapshotDiscountStartsAt: item.snapshotDiscountStartsAt ? new Date(item.snapshotDiscountStartsAt) : null,
      snapshotDiscountEndsAt: item.snapshotDiscountEndsAt ? new Date(item.snapshotDiscountEndsAt) : null
    })));
    await tx.update(checkoutReservations).set({ state: "finalized" })
      .where(eq(checkoutReservations.checkoutSessionId, match.session.id));
    await tx.update(paymentAttempts).set({
      status: "succeeded",
      paymobTransactionId: String(transaction.id),
      integrationId: Number(transaction.integration_id),
      paymentMethod: transaction.source_data?.type === "wallet" ? "wallet" : "card"
    }).where(eq(paymentAttempts.id, match.attempt.id));
    await tx.update(checkoutSessions).set({ state: "completed", createdOrderId: order.id })
      .where(eq(checkoutSessions.id, match.session.id));
    await enqueueOrderDelivery(tx, order.id);
    if (match.attempt.earlyRefundAmountCents > 0) await blockRefundedDelivery(tx, order.id);
    if (match.session.customerId != null) {
      await tx.update(carts).set({ lines: [] }).where(eq(carts.customerId, match.session.customerId));
    }
    return { outcome: "succeeded" as const, orderId: order.id, paymentAttemptId: match.attempt.id, checkoutSessionId: match.session.id };
  }
}
