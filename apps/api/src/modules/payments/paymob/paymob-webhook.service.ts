import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orders, paymentAttempts, paymentWebhookEvents, paymobCallbackInbox } from "@capella/database/drizzle/schema";

/** Bump when the normalized field set changes. Old rows are never re-interpreted under a new fingerprint definition, so a version bump cannot silently re-deduplicate history. */
export const PAYMOB_INBOX_FINGERPRINT_VERSION = 3;

/** Only these fields are retained. Three deliberate exclusions: `refunded_amount_cents` (NOT HMAC-covered, attacker-controlled, must never be stored in the payload evidence checks read), `source_data.pan` (card data — only the method type is kept), and `order` (rebuilt from a scalar allowlist rather than copied, so extra nested properties cannot survive into stored evidence).
 * `is_live` is retained in the payload (harmless descriptive data) but EXCLUDED from the fingerprint because it is unsigned — leaving it in the identity let one validly signed callback replayed with the flag flipped mint unlimited distinct receipts. */
const NORMALIZED_FIELDS = ["id", "integration_id", "amount_cents", "currency", "success", "pending",
  "is_auth", "is_capture", "is_voided", "is_refunded", "has_parent_transaction", "is_live",
  "created_at", "error_occured", "owner", "is_3d_secure", "is_standalone_payment"] as const;

/** The only order properties retained: scalars that participate in signed correlation. */
const NORMALIZED_ORDER_FIELDS = ["id"] as const;

/** The UNSIGNED refund amount, retained only to tell genuinely different refund events apart — it is never evidence (`hasUnresolvedFinancialEvidence` and the refund guards read only the authenticated inquiry).
 * Its sole purpose is scheduling: without it a refund growing from 1,200 to 3,500 cents fingerprints identically to the first, resolves to the same completed receipt, and the progression is dropped without trace; being unsigned caps it to causing an extra inquiry, never a financial decision. */
function unsignedRefundHint(transaction: Record<string, unknown>): number | null {
  if (transaction.is_refunded !== true) return null;
  const amount = Number(transaction.refunded_amount_cents);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function normalizeCallback(transaction: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const field of NORMALIZED_FIELDS) if (transaction[field] !== undefined) normalized[field] = transaction[field];
  // Rebuild `order` from an explicit scalar allowlist; copying the whole object retained whatever nested data the callback carried — including synthetic card details — inside the payload that evidence checks treat as provider-signed.
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

/** Durably records a callback BEFORE any business processing runs, so a crash, a slow provider read or a process restart cannot lose a notification Paymob considers delivered; identical redeliveries resolve to the original row instead of a new one. */
export async function receivePaymobCallback(input: {
  callbackType: "transaction" | "card_token";
  transaction: Record<string, unknown>;
}): Promise<ReceivedPaymobCallback> {
  const normalized = normalizeCallback(input.transaction);
  // The fingerprint runs over the same allowlisted payload, minus the fields Paymob's HMAC does not cover; `is_live` is the one such field retained in the payload, and keeping it in the identity would let a single validly signed callback be replayed with the flag flipped to manufacture unlimited distinct receipts.
  const { is_live: _unsignedEnvironmentFlag, ...fingerprintPayload } = normalized;
  const eventFingerprint = createHash("sha256").update(JSON.stringify({
    v: PAYMOB_INBOX_FINGERPRINT_VERSION, type: input.callbackType, payload: fingerprintPayload,
    // Scheduling hint only - see unsignedRefundHint. It separates distinct refund events without ever contributing evidence.
    refund_hint: unsignedRefundHint(input.transaction)
  })).digest("hex");
  const hinted = input.transaction.id;
  const orderId = (normalized.order as { id?: unknown } | undefined)?.id;
  const signedOrderId = orderId === undefined || orderId === null ? null : String(orderId);
  const signedIntegrationId = typeof input.transaction.integration_id === "number"
    && Number.isSafeInteger(input.transaction.integration_id) && input.transaction.integration_id > 0
    ? input.transaction.integration_id
    : null;
  const [bound] = signedOrderId === null ? [] : await db.select({ sessionId: paymentAttempts.checkoutSessionId })
    .from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, signedOrderId)).limit(1);
  return db.transaction(async tx => {
    // Receipt and expiry/retry use the same session lock when the signed ID is already locally bound. Unbound receipts cannot assert an arbitrary stock hold.
    if (bound) {
      const [session] = await tx.select({ orderId: checkoutSessions.createdOrderId }).from(checkoutSessions)
        .where(eq(checkoutSessions.id, bound.sessionId)).for("update");
      // Dispatch owns the order lock. Publishing a bound refund hold under that same lock prevents its preflight snapshot from missing an earlier receipt.
      if (session?.orderId) await tx.select({ id: orders.id }).from(orders)
        .where(eq(orders.id, session.orderId)).for("update");
    }
    try {
      const [row] = await tx.insert(paymobCallbackInbox).values({
        eventFingerprint, fingerprintVersion: PAYMOB_INBOX_FINGERPRINT_VERSION, normalizedPayload: normalized,
        // Identity is stored as scalars, not only inside the JSON payload — the evidence checks that decide whether stock stays held read these columns through an index, whereas extracting from JSON meant scanning rows so an unrelated backlog could starve a genuine match and silently release paid-for stock.
        // The binding is PROVEN, never assumed: it comes from the attempt that actually holds this signed provider order id, and a callback naming an unknown order id stays unbound (forcing it onto a session would let an unauthenticated callback claim a checkout's stock).
        signedOrderId, signedIntegrationId, boundSessionId: bound?.sessionId ?? null,
        hintedTransactionId: hinted === undefined || hinted === null ? null : String(hinted),
        callbackType: input.callbackType, processingStatus: "received", nextAttemptAt: new Date(), receivedAt: new Date()
      }).$returningId();
      return { id: row!.id, eventFingerprint, duplicate: false };
    } catch (error) {
      if (!isDuplicateEntry(error)) throw error;
      // A redelivery of something already received: return the original receipt rather than pretending this delivery is new.
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

/** Legacy audit writer for historical consumers (production processing writes audit atomically); excludes `is_live` for the same reason the production audit identity does — it is outside Paymob's HMAC input list, so it is not evidence of a distinct real-world event. */
export async function recordPaymobTransaction(
  transaction: Record<string, unknown>,
  processingStatus: "processed" | "rejected"
): Promise<void> {
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
