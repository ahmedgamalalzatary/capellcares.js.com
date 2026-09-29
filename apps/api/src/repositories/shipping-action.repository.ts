import { and, eq, inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shippingWorkItems, orderReviewFlags } from "@capella/database/drizzle/schema";
import type { ShippingBulkRequest, ShippingBulkResult } from "@capella/shared";
import { shippingFlagResolutionSchema, checkoutShippingQuoteSchema } from "@capella/shared";
import { assertShippingActor, applyShippingNoMoneyEdit, reconcileShippingEdit } from "./shipping-edit.repository.js";
import { resolveBostaEditRuntime } from "../modules/shipping/bosta/bosta-edit.service.js";
import { resolveBostaSyncRuntime } from "../modules/shipping/bosta/bosta-sync.service.js";
import { requestShippingCancellation } from "./shipping-cancellation.repository.js";
import { recordOrderManualState } from "./shipping-state.repository.js";

type Order = typeof orders.$inferSelect;
/** MySQL DATETIME(0) rounds fractional seconds, so align to whole seconds to keep due-now jobs claimable. */
const dueNow = () => new Date(Math.floor(Date.now() / 1000) * 1000);

export class ShippingConfigurationError extends Error {
  constructor() { super("Shipping provider configuration is unavailable"); }
}
function actionRuntime<T>(resolve: () => T): T {
  try { return resolve(); }
  catch { throw new ShippingConfigurationError(); }
}
export function editOrderShipment(orderId: number, patch: unknown, actorId: number) {
  const runtime = actionRuntime(() => resolveBostaEditRuntime());
  return applyShippingNoMoneyEdit(orderId, patch, actorId, runtime);
}

async function lockedShippingOrder(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], orderId: number): Promise<Order> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
  if (!order?.shippingSnapshot) throw new Error("Shipping order not found");
  return order;
}

async function lockedCreateJob(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], orderId: number) {
  const [job] = await tx.select().from(shippingWorkItems).where(and(
    eq(shippingWorkItems.orderId, orderId), eq(shippingWorkItems.operation, "create_delivery"))).limit(1).for("update");
  if (!job) throw new Error("No delivery creation work exists for this order");
  return job;
}

/** Staff-reviewed recovery for definitively failed delivery creation; the worker re-checks
 *  dispatchability at claim time, so a still-blocked order simply stops again. */
export async function retryOrderDeliveryCreation(orderId: number, actorId: number) {
  return db.transaction(async tx => {
    const order = await lockedShippingOrder(tx, orderId);
    await assertShippingActor(tx, actorId);
    if (order.cancellationStatus || order.paymentStatus === "denied" || order.refundedAmountCents > 0 ||
      (order.paymentMethod === "paymob" && order.providerPaymentStatus !== "succeeded")) throw new Error("Denied/refunded/cancelling orders are locked");
    const job = await lockedCreateJob(tx, orderId);
    if (job.status !== "failed") {
      throw new Error("Only failed delivery creation can be retried; uncertain outcomes need reconciliation first");
    }
    await tx.update(shippingWorkItems).set({ status: "pending", lastError: null, nextAttemptAt: dueNow(),
      attemptCount: 0, claimedBy: null, claimedAt: null }).where(eq(shippingWorkItems.id, job.id));
    return true;
  });
}

/** Read-only recovery of uncertain creation: make the job due so the worker reconciles it
 *  through carrier reads, never a resend. */
export async function reconcileOrderDeliveryCreation(orderId: number, actorId: number) {
  const outcome = await db.transaction(async tx => {
    await lockedShippingOrder(tx, orderId);
    await assertShippingActor(tx, actorId);
    const [edit] = await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, orderId),
      eq(shippingWorkItems.operation, "edit_delivery"), inArray(shippingWorkItems.status, ["processing", "review_required"]))).limit(1).for("update");
    if (edit && ["processing", "review_required"].includes(edit.status)) return "edit" as const;
    const job = await lockedCreateJob(tx, orderId);
    const uncertain = job.lastError === "CREATE_UNCERTAIN" || (job.lastError === "ATTEMPT_LIMIT_REVIEW" && job.requestSnapshot !== null);
    if (job.status !== "review_required" || !uncertain) {
      throw new Error("Reconcile applies only to uncertain delivery creation outcomes");
    }
    if (job.nextAttemptAt.getTime() <= Date.now() && job.lastError === "CREATE_UNCERTAIN") return false;
    await tx.update(shippingWorkItems).set({ nextAttemptAt: dueNow(), lastError: "CREATE_UNCERTAIN", claimedBy: null, claimedAt: null })
      .where(eq(shippingWorkItems.id, job.id));
    return true;
  });
  return outcome === "edit" ? reconcileShippingEdit(orderId, actionRuntime(() => resolveBostaSyncRuntime())) : outcome;
}

export async function resolveShippingFlags(orderId: number, input: unknown, actorId: number, flagId?: number) {
  const { note } = shippingFlagResolutionSchema.parse(input);
  return db.transaction(async tx => {
    await lockedShippingOrder(tx, orderId);
    await assertShippingActor(tx, actorId);
    const flags = await tx.select().from(orderReviewFlags).where(and(eq(orderReviewFlags.orderId, orderId),
      flagId === undefined ? eq(orderReviewFlags.status, "open") : eq(orderReviewFlags.id, flagId))).for("update");
    if (flagId !== undefined && !flags.length) throw new Error("Review flag not found for this order");
    let changed = 0;
    for (const flag of flags) if (flag.status === "open") {
      const now = new Date();
      await tx.update(orderReviewFlags).set({ status: "resolved", resolvedAt: now,
        reason: `${flag.reason}\nResolved by staff #${actorId} at ${now.toISOString()}: ${note}` }).where(eq(orderReviewFlags.id, flag.id));
      changed++;
    }
    return changed;
  });
}

/** D55: bulk selection never overrides per-record eligibility; each record runs the same checks. */
export async function runBulkShippingAction(action: ShippingBulkRequest["action"], orderIds: number[],
  input: Omit<ShippingBulkRequest, "action" | "orderIds"> & { actorId: number }): Promise<ShippingBulkResult[]> {
  const results: ShippingBulkResult[] = [];
  for (const orderId of new Set(orderIds)) {
    try {
      if (action === "retry") await retryOrderDeliveryCreation(orderId, input.actorId);
      else if (action === "reconcile") await reconcileOrderDeliveryCreation(orderId, input.actorId);
      else if (action === "cancel") await requestShippingCancellation(orderId,
        { source: "staff", actorId: input.actorId, reason: input.reason });
      else if (action === "manual_state") await recordOrderManualState(orderId, { state: input.state, reason: input.reason }, input.actorId);
      else if (action === "shipment_edit") {
        let patch = input.patch;
        if (input.addressLines) {
          const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
          if (!order?.shippingSnapshot) throw new Error("Shipping order not found");
          const { cityId, zoneId, districtId } = checkoutShippingQuoteSchema.parse(JSON.parse(order.shippingSnapshot)).address;
          patch = { ...patch, address: { cityId, zoneId, districtId, ...input.addressLines } };
        }
        await editOrderShipment(orderId, patch, input.actorId);
      }
      else await resolveShippingFlags(orderId, { note: input.note }, input.actorId);
      results.push({ orderId, status: "ok" });
    } catch (error) {
      results.push({ orderId, status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
