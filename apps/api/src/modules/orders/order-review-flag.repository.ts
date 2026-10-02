import { and, desc, eq, inArray } from "drizzle-orm";
import type { AdminOrderReviewFlagDto } from "@capella/shared";
import { db } from "@capella/database/src/db";
import { orderReviewFlags, orders } from "@capella/database/drizzle/schema";
import { toNumber } from "./order/shared.js";

type ReviewFlagType = typeof orderReviewFlags.$inferSelect.flagType;

/**
 * D27/O12: `untouched_paid` is an informational staff alert, not a shipping safety guard.
 * It can be acknowledged to clear the notification, but it must never hold a shipment and
 * may be resolved through the alert endpoint. Every other flag type stays a
 * dispatch guard that only the S13 staff action can clear.
 */
export const INFORMATIONAL_REVIEW_FLAG_TYPES: ReviewFlagType[] = ["untouched_paid"];

/** True when this flag is a real safety hold that must block dispatch. */
export const isSafetyReviewFlag = (flagType: ReviewFlagType) => !INFORMATIONAL_REVIEW_FLAG_TYPES.includes(flagType);

/** True only when a real safety flag is open; informational alerts never block dispatch. */
export async function isOrderBlockedByOpenReviewFlag(orderId: number): Promise<boolean> {
  const rows = await db.select({ flagType: orderReviewFlags.flagType }).from(orderReviewFlags).where(and(
    eq(orderReviewFlags.orderId, orderId), eq(orderReviewFlags.status, "open")));
  return rows.some((row) => isSafetyReviewFlag(row.flagType));
}

/** Staff alert feed for every unresolved review flag, with just enough order identity to act. */
export async function listOpenOrderReviewFlagsRepo(): Promise<AdminOrderReviewFlagDto[]> {
  const rows = await db.select({
    id: orderReviewFlags.id,
    orderId: orderReviewFlags.orderId,
    flagType: orderReviewFlags.flagType,
    reason: orderReviewFlags.reason,
    status: orderReviewFlags.status,
    flaggedAt: orderReviewFlags.createdAt,
    orderCode: orders.orderCode,
    customerName: orders.fullName,
    totalAmount: orders.totalAmount,
    orderCreatedAt: orders.createdAt
  }).from(orderReviewFlags)
    .innerJoin(orders, eq(orders.id, orderReviewFlags.orderId))
    .where(eq(orderReviewFlags.status, "open"))
    .orderBy(desc(orderReviewFlags.createdAt));

  return rows.map((row) => ({
    id: row.id,
    orderId: row.orderId,
    orderCode: row.orderCode,
    flagType: row.flagType,
    reason: row.reason,
    status: row.status,
    customerName: row.customerName,
    totalAmount: toNumber(row.totalAmount),
    orderCreatedAt: row.orderCreatedAt.toISOString(),
    flaggedAt: row.flaggedAt.toISOString()
  }));
}

export class SafetyReviewFlagError extends Error {}

/**
 * Acknowledging an alert is pure staff visibility: it never denies, refunds or restocks an
 * order. Only informational flags may be acknowledged here; a safety flag is a dispatch hold
 * that the S13 staff action owns, so the alert endpoint must never be able to clear it.
 */
export async function resolveOrderReviewFlagRepo(flagId: number, now = new Date()): Promise<boolean> {
  const [flag] = await db.select({ id: orderReviewFlags.id, flagType: orderReviewFlags.flagType, status: orderReviewFlags.status })
    .from(orderReviewFlags).where(eq(orderReviewFlags.id, flagId)).limit(1);
  if (!flag) return false;
  if (isSafetyReviewFlag(flag.flagType)) {
    throw new SafetyReviewFlagError("Shipping safety flags are cleared by the staff order action, not by dismissing an alert");
  }
  if (flag.status === "resolved") return false;
  const result = await db.update(orderReviewFlags)
    .set({ status: "resolved", resolvedAt: now })
    .where(and(eq(orderReviewFlags.id, flagId), eq(orderReviewFlags.status, "open")));
  return (result[0].affectedRows ?? 0) > 0;
}
