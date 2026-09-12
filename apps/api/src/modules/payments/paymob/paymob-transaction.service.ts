import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, orderItems, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { generateOrderCode, generatePendingOrderCode } from "../../../repositories/order/shared.js";

type PaymobTransaction = Record<string, any> & { order?: { id?: unknown }; source_data?: { type?: unknown } };

export async function processPaymobTransaction(transaction: PaymobTransaction) {
  return db.transaction(async (tx) => {
    const [match] = await tx.select({
      attempt: paymentAttempts,
      session: checkoutSessions
    }).from(paymentAttempts)
      .innerJoin(checkoutSessions, eq(checkoutSessions.id, paymentAttempts.checkoutSessionId))
      .where(eq(paymentAttempts.paymobOrderId, String(transaction.order?.id ?? "")))
      .limit(1)
      .for("update");
    if (!match) return { outcome: "unmatched" as const };

    if (match.attempt.status === "succeeded" && match.session.createdOrderId) {
      if (transaction.is_refunded === true) {
        const refundedCents = Number(transaction.refunded_amount_cents);
        if (String(transaction.id) !== match.attempt.paymobTransactionId ||
          Number(transaction.amount_cents) !== match.attempt.amountCents ||
          transaction.currency !== match.attempt.currency ||
          Number(transaction.integration_id) !== match.attempt.integrationId ||
          match.attempt.environment !== (transaction.is_live === true ? "live" : "test") ||
          !Number.isSafeInteger(refundedCents) || refundedCents <= 0 || refundedCents > match.attempt.amountCents) {
          return { outcome: "rejected" as const };
        }
        await tx.update(orders).set({
          refundedAmountCents: refundedCents,
          providerPaymentStatus: refundedCents === match.attempt.amountCents ? "refunded" : "partially_refunded"
        }).where(and(eq(orders.id, match.session.createdOrderId),
          lt(orders.refundedAmountCents, refundedCents)));
        return { outcome: "refunded" as const, orderId: match.session.createdOrderId };
      }
      return {
        outcome: "succeeded" as const,
        orderId: match.session.createdOrderId,
        paymentAttemptId: match.attempt.id,
        checkoutSessionId: match.session.id
      };
    }
    const environmentMatches = match.attempt.environment === (transaction.is_live === true ? "live" : "test");
    const allowedIntegrationIds = match.attempt.allowedIntegrationIds
      ? JSON.parse(match.attempt.allowedIntegrationIds) as unknown
      : [match.attempt.integrationId];
    const integrationMatches = Array.isArray(allowedIntegrationIds) &&
      allowedIntegrationIds.includes(Number(transaction.integration_id));
    const validIdentity =
      transaction.is_auth === false && transaction.is_capture === false &&
      transaction.is_refunded === false && transaction.is_voided === false &&
      transaction.has_parent_transaction === false &&
      Number(transaction.amount_cents) === match.attempt.amountCents &&
      transaction.currency === match.attempt.currency &&
      integrationMatches &&
      environmentMatches;
    if (!validIdentity) return { outcome: "rejected" as const };
    if (transaction.pending === true) return { outcome: "pending" as const };
    if (transaction.pending !== false) return { outcome: "rejected" as const };
    if (transaction.success === false) {
      await tx.update(paymentAttempts).set({ status: "failed", paymobTransactionId: String(transaction.id) })
        .where(eq(paymentAttempts.id, match.attempt.id));
      if (match.attempt.attemptNumber === match.session.attemptCount &&
        match.session.attemptCount >= 3 && match.session.state === "payment_pending") {
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
      return { outcome: "failed" as const };
    }
    if (transaction.success !== true) return { outcome: "rejected" as const };

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
      paymentStatus: "pending",
      providerPaymentStatus: "succeeded",
      paymentAttemptId: match.attempt.id,
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
    return { outcome: "succeeded" as const, orderId: order.id, paymentAttemptId: match.attempt.id, checkoutSessionId: match.session.id };
  });
}
