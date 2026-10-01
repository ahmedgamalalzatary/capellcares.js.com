import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { paymentWebhookEvents, paymobCallbackInbox } from "@capella/database/drizzle/schema";

/**
 * Bump when the normalized field set changes. Old rows are never re-interpreted under a
 * new fingerprint definition, so a version bump cannot silently re-deduplicate history.
 */
export const PAYMOB_INBOX_FINGERPRINT_VERSION = 1;

/**
 * Only these fields are retained. Two deliberate exclusions:
 *  - `refunded_amount_cents` is NOT in Paymob's HMAC input list, so it is attacker
 *    controlled and must never be stored as usable evidence.
 *  - `source_data.pan` is card data; only the payment method type is kept.
 */
const NORMALIZED_FIELDS = ["id", "order", "integration_id", "amount_cents", "currency", "success", "pending",
  "is_auth", "is_capture", "is_voided", "is_refunded", "has_parent_transaction", "is_live",
  "created_at", "error_occured", "owner", "is_3d_secure", "is_standalone_payment"] as const;

function normalizeCallback(transaction: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const field of NORMALIZED_FIELDS) if (transaction[field] !== undefined) normalized[field] = transaction[field];
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
    v: PAYMOB_INBOX_FINGERPRINT_VERSION, type: input.callbackType, payload: normalized
  })).digest("hex");
  const hinted = input.transaction.id;
  try {
    const [row] = await db.insert(paymobCallbackInbox).values({
      eventFingerprint, fingerprintVersion: PAYMOB_INBOX_FINGERPRINT_VERSION, normalizedPayload: normalized,
      hintedTransactionId: hinted === undefined || hinted === null ? null : String(hinted),
      callbackType: input.callbackType, processingStatus: "received"
    }).$returningId();
    return { id: row!.id, eventFingerprint, duplicate: false };
  } catch (error) {
    if (!isDuplicateEntry(error)) throw error;
    // A redelivery of something already received: return the original receipt rather
    // than pretending this delivery is new.
    const [existing] = await db.select({ id: paymobCallbackInbox.id }).from(paymobCallbackInbox)
      .where(eq(paymobCallbackInbox.eventFingerprint, eventFingerprint)).limit(1);
    return { id: existing!.id, eventFingerprint, duplicate: true };
  }
}

function isDuplicateEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === "ER_DUP_ENTRY" || candidate.cause?.code === "ER_DUP_ENTRY";
}

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
