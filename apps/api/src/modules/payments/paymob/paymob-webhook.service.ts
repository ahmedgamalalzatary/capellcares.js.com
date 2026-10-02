import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orders, paymentAttempts, paymentWebhookEvents, paymobCallbackInbox } from "@capella/database/drizzle/schema";

/**
 * Bump when the normalized field set changes. Old rows are never re-interpreted under a
 * new fingerprint definition, so a version bump cannot silently re-deduplicate history.
 */
export const PAYMOB_INBOX_FINGERPRINT_VERSION = 2;

/**
 * Only these fields are retained. Three deliberate exclusions:
 *  - `refunded_amount_cents` is NOT in Paymob's HMAC input list, so it is attacker
 *    controlled and must never be stored inside the payload that evidence checks read.
 *  - `source_data.pan` is card data; only the payment method type is kept.
 *  - `order` is rebuilt from a scalar allowlist rather than copied, so extra nested
 *    properties a callback chooses to include cannot survive into stored evidence.
 */
const NORMALIZED_FIELDS = ["id", "integration_id", "amount_cents", "currency", "success", "pending",
  "is_auth", "is_capture", "is_voided", "is_refunded", "has_parent_transaction", "is_live",
  "created_at", "error_occured", "owner", "is_3d_secure", "is_standalone_payment"] as const;

/** The only order properties retained: scalars that participate in signed correlation. */
const NORMALIZED_ORDER_FIELDS = ["id"] as const;

/**
 * The UNSIGNED refund amount, retained only to tell genuinely different refund events apart.
 *
 * It is never evidence - `hasUnresolvedFinancialEvidence` and the refund guards read only
 * the authenticated inquiry. Its sole purpose is scheduling: without it, a refund growing
 * from 1,200 to 3,500 cents fingerprints identically to the first, resolves to the same
 * completed receipt, and the progression is dropped without trace. Being unsigned caps what
 * it may do: it can cause an extra inquiry, never a financial decision.
 */
function unsignedRefundHint(transaction: Record<string, unknown>): number | null {
  if (transaction.is_refunded !== true) return null;
  const amount = Number(transaction.refunded_amount_cents);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function normalizeCallback(transaction: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const field of NORMALIZED_FIELDS) if (transaction[field] !== undefined) normalized[field] = transaction[field];
  // Rebuild `order` from an explicit scalar allowlist. Copying the whole object retained
  // whatever nested data the callback carried - including synthetic card details - inside
  // the payload that evidence checks treat as provider-signed.
  const order = transaction.order;
  if (order !== null && typeof order === "object") {
    const rebuilt: Record<string, unknown> = {};
    for (const field of NORMALIZED_ORDER_FIELDS) {
      const value = (order as Record<string, unknown>)[field];
      if (value !== undefined) rebuilt[field] = value;
    }
    if (Object.keys(rebuilt).length > 0) normalized.order = rebuilt;
  }
  const sourceData = transaction.source_data as { type?: unknown } | undefined;
  const method = sourceData?.type;
  if (method !== undefined) normalized.payment_method = method;
  return normalized;
}

export type ReceivedPaymobCallback = { id: number; eventFingerprint: string; duplicate: boolean };

/**
 * Durably records a callback BEFORE any business processing runs, so a crash, a slow
 * provider read or a process restart cannot lose a notification Paymob considers
 * delivered. Identical redeliveries resolve to the original row instead of a new one.
 */
export async function receivePaymobCallback(input: {
  callbackType: "transaction" | "card_token";
  transaction: Record<string, unknown>;
}): Promise<ReceivedPaymobCallback> {
  const normalized = normalizeCallback(input.transaction);
  const eventFingerprint = createHash("sha256").update(JSON.stringify({
    v: PAYMOB_INBOX_FINGERPRINT_VERSION, type: input.callbackType, payload: normalized,
    // Scheduling hint only - see unsignedRefundHint. It separates distinct refund events
    // without ever contributing evidence.
    refund_hint: unsignedRefundHint(input.transaction)
  })).digest("hex");
  const hinted = input.transaction.id;
  const orderId = (normalized.order as { id?: unknown } | undefined)?.id;
  const [bound] = orderId === undefined ? [] : await db.select({ sessionId: paymentAttempts.checkoutSessionId })
    .from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, String(orderId))).limit(1);
  return db.transaction(async tx => {
    // Receipt and expiry/retry use the same session lock when the signed ID is
    // already locally bound. Unbound receipts cannot assert an arbitrary stock hold.
    if (bound) {
      const [session] = await tx.select({ orderId: checkoutSessions.createdOrderId }).from(checkoutSessions)
        .where(eq(checkoutSessions.id, bound.sessionId)).for("update");
      // Dispatch owns the order lock. Publishing a bound refund hold under that
      // same lock prevents its preflight snapshot from missing an earlier receipt.
      if (session?.orderId) await tx.select({ id: orders.id }).from(orders)
        .where(eq(orders.id, session.orderId)).for("update");
    }
    try {
      const [row] = await tx.insert(paymobCallbackInbox).values({
        eventFingerprint, fingerprintVersion: PAYMOB_INBOX_FINGERPRINT_VERSION, normalizedPayload: normalized,
        hintedTransactionId: hinted === undefined || hinted === null ? null : String(hinted),
        callbackType: input.callbackType, processingStatus: "received", nextAttemptAt: new Date(), receivedAt: new Date()
      }).$returningId();
      return { id: row!.id, eventFingerprint, duplicate: false };
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error;
      // A redelivery of something already received: return the original receipt rather
      // than pretending this delivery is new.
      const [existing] = await tx.select({ id: paymobCallbackInbox.id }).from(paymobCallbackInbox)
        .where(eq(paymobCallbackInbox.eventFingerprint, eventFingerprint)).limit(1);
      return { id: existing!.id, eventFingerprint, duplicate: true };
    }
  });
}

function isDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === "ER_DUP_ENTRY" || candidate.cause?.code === "ER_DUP_ENTRY";
}

/** Legacy audit writer for historical consumers; production processing writes audit atomically. */
export async function recordPaymobTransaction(
  transaction: Record<string, unknown>,
  processingStatus: "processed" | "rejected"
): Promise<void> {
  const identity = JSON.stringify({
    id: transaction.id,
    order_id: (transaction.order as { id?: unknown } | undefined)?.id,
    integration_id: transaction.integration_id,
    is_live: transaction.is_live,
    success: transaction.success,
    pending: transaction.pending,
    is_auth: transaction.is_auth,
    is_capture: transaction.is_capture,
    is_refunded: transaction.is_refunded,
    is_voided: transaction.is_voided,
    refunded_amount_cents: transaction.refunded_amount_cents,
    captured_amount: transaction.captured_amount
  });
  const eventFingerprint = createHash("sha256").update(identity).digest("hex");
  try {
    await db.insert(paymentWebhookEvents).values({
      provider: "paymob",
      callbackType: "transaction",
      eventFingerprint,
      processingStatus,
      processedAt: new Date()
    });
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error;
  }
}
