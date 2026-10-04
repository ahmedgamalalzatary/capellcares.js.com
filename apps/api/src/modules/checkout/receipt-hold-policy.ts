/** The single typed policy for whether a durably received callback must keep stock held.
 * Before this every unresolved receipt was treated as a hold, which was wrong against the business: a decline/unsupported action resolves to `rejected`/`failed` and sits in `review_required`, so an abandoned session could hold its reservation indefinitely. Classification uses ONLY signed fields (`is_refunded`, `success`, `pending` are in Paymob's HMAC list; `is_live` and `refunded_amount_cents` are not): ACTIONABLE (success/refund) → HOLD, INACTIONABLE (decline/void) → do not hold, and PENDING is treated as actionable because a pending authorisation can still capture (bounded by the receipt's own retry policy, not this function). */

import { sql, type Column, type SQL } from "drizzle-orm";

export type ReceiptHoldReason =
  /** The provider reports money received, or a refund that must be applied. */
  | "success"
  | "refund"
  /** An authorisation in flight that may still capture. */
  | "pending"
  /** Durably received, but nothing about it can become money. */
  | "decline"
  | "unsupported_action"
  | "not_actionable";

export type ReceiptHoldDecision = {
  holds: boolean;
  reason: ReceiptHoldReason;
};

/** Classify one stored receipt payload. `payload` is the allowlisted normalized snapshot; only signed fields are read, and anything missing or malformed is treated as INACTIONABLE rather than actionable — holding on an unreadable receipt would let a malformed/stripped payload hold stock forever, while the actionable cases are provable from fields always present on a real callback. */
export function classifyReceiptHold(payload: unknown): ReceiptHoldDecision {
  const record = (payload !== null && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  if (record.is_refunded === true) return { holds: true, reason: "refund" };
  if (record.success === true) return { holds: true, reason: "success" };
  if (record.pending === true) return { holds: true, reason: "pending" };
  // `pending: false` with `success: false` is an outright decline: the provider has told us the payment did not happen. Nothing further can turn it into money.
  if (record.pending === false && record.success === false) return { holds: false, reason: "decline" };
  // Anything else is a callback shape we do not recognise as a payment outcome (for example an unsupported action type). It cannot assert a hold.
  return { holds: false, reason: "unsupported_action" };
}

/** True when this payload must keep stock held until the receipt resolves. */
export function receiptHoldsStock(payload: unknown): boolean {
  return classifyReceiptHold(payload).holds;
}

/** The signed provider order id a stored receipt claims, read from the payload — the UPGRADE-WINDOW fallback only. `signed_order_id` is indexed and is what correlation should use; this exists because migration 0063 adds that column NULL for pre-existing rows and the backfill runs separately, and reading only the scalar during that window silently misses every un-backfilled receipt (so a paid checkout looks unevidenced and expiry releases its stock). `order.id` is HMAC-covered so it stays trustworthy while unindexed, and is never consulted once the backfill has run. */
export function payloadSignedOrderId(payload: unknown): string | null {
  const order = (payload !== null && typeof payload === "object" ? payload : null) as { order?: { id?: unknown } } | null;
  const id = order?.order?.id;
  return id === undefined || id === null || id === "" ? null : String(id);
}

/** The same policy expressed as a SQL predicate for the expiry sweep's candidate query, because discovery needs to know which sessions are held without taking a lock while the per-candidate recheck evaluates them in application code — two implementations is exactly how these paths drifted apart, so the rules live here once and a test proves the SQL form decides identically to `receiptHoldsStock` against real MySQL.
 * The JSON TYPE is checked as well as the value (`JSON_UNQUOTE(JSON_EXTRACT(...))` of the STRING "true" also yields `true`, so a value-only comparison would treat a string `"true"` as a hold here while `receiptHoldsStock` rejects it); built from the same three signed fields as `classifyReceiptHold` and nothing else. */
export function sqlReceiptHoldsStock(payloadColumn: SQL | Column): SQL {
  const isTrueBoolean = (name: string) => {
    const extracted = sql`json_extract(${payloadColumn}, '$.${sql.raw(name)}')`;
    return sql`(json_type(${extracted}) = 'BOOLEAN' AND json_unquote(${extracted}) = 'true')`;
  };
  return sql`(${isTrueBoolean("is_refunded")} OR ${isTrueBoolean("success")} OR ${isTrueBoolean("pending")})`;
}