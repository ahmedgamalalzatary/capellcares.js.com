/**
 * The single typed policy for whether a durably received callback must keep stock held.
 *
 * Before this, every unresolved receipt was treated as a financial hold. That was wrong in
 * the customer's favour but against the business: a decline or an unsupported action is
 * durably received, resolves to `rejected`/`failed` and then sits in `review_required`, and
 * an abandoned session could therefore hold its reservation indefinitely. Stock that can
 * never be sold is stock another customer cannot buy.
 *
 * The classification is driven ONLY by signed fields:
 *
 *   - `is_refunded` and `success` ARE in Paymob's HMAC input list.
 *   - `pending` IS in the HMAC input list.
 *
 * So the decision below cannot be steered by an unsigned field. In particular `is_live` and
 * `refunded_amount_cents` are NOT consulted, because neither is signed.
 *
 * Two rules, and the asymmetry between them is deliberate:
 *
 *   1. ACTIONABLE (success or refund) -> HOLD. The customer may already have paid, or may
 *      need a refund applied. Releasing here frees stock the eventual success would have to
 *      fulfil with nothing, and drops a real refund. Holding too long is recoverable; the
 *      staff queue exists exactly for this.
 *
 *   2. INACTIONABLE (decline, unsupported action, void) -> DO NOT HOLD. Nothing about a
 *      decline can turn into money later. Holding on it is a pure loss.
 *
 * A PENDING callback is the genuinely hard case and is treated as ACTIONABLE, because a
 * pending authorisation can still capture. It is bounded by the receipt's own retry policy
 * rather than by this function: the recovery sweep drives it to a terminal state or to
 * `review_required`, and only the actionable classifications above remain unresolved
 * indefinitely.
 */

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

/**
 * Classify one stored receipt payload.
 *
 * `payload` is the allowlisted normalized snapshot. Only signed fields are read; anything
 * missing or malformed is treated as INACTIONABLE rather than actionable, because holding
 * on an unreadable receipt would let a malformed or stripped payload hold stock forever,
 * while the actionable cases are all provable from fields that are always present on a real
 * Paymob transaction callback.
 */
export function classifyReceiptHold(payload: unknown): ReceiptHoldDecision {
  const record = (payload !== null && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  if (record.is_refunded === true) return { holds: true, reason: "refund" };
  if (record.success === true) return { holds: true, reason: "success" };
  if (record.pending === true) return { holds: true, reason: "pending" };
  // `pending: false` with `success: false` is an outright decline: the provider has told us
  // the payment did not happen. Nothing further can turn it into money.
  if (record.pending === false && record.success === false) return { holds: false, reason: "decline" };
  // Anything else is a callback shape we do not recognise as a payment outcome (for example
  // an unsupported action type). It cannot assert a hold.
  return { holds: false, reason: "unsupported_action" };
}

/** True when this payload must keep stock held until the receipt resolves. */
export function receiptHoldsStock(payload: unknown): boolean {
  return classifyReceiptHold(payload).holds;
}

/**
 * The signed provider order id a stored receipt claims, read from the payload.
 *
 * This is the UPGRADE-WINDOW fallback only. `signed_order_id` is indexed and is what
 * correlation should use; this exists because migration 0063 adds that column as NULL for
 * every pre-existing row, and the backfill that fills it runs separately. Reading only the
 * scalar during that window silently misses every un-backfilled receipt, so a checkout the
 * customer already paid for looks unevidenced and expiry releases its stock.
 *
 * `order.id` is covered by Paymob's HMAC, so it remains trustworthy evidence while unindexed.
 * Once the backfill has run this is never consulted, because the scalar lookup already
 * matched.
 */
export function payloadSignedOrderId(payload: unknown): string | null {
  const order = (payload !== null && typeof payload === "object" ? payload : null) as { order?: { id?: unknown } } | null;
  const id = order?.order?.id;
  return id === undefined || id === null || id === "" ? null : String(id);
}

/**
 * The same policy expressed as a SQL predicate, for the expiry sweep's candidate query.
 *
 * This exists because expiry DISCOVERY needs to know which sessions are held without taking
 * a lock, while the per-candidate recheck under the session lock evaluates them in
 * application code. Two implementations of "is this receipt actionable" is precisely how
 * these paths drifted apart in the first place, so the rules live here once and a test
 * proves the SQL form decides identically to `receiptHoldsStock` against real MySQL.
 *
 * The JSON TYPE is checked as well as the value. `JSON_UNQUOTE(JSON_EXTRACT(...))` of the
 * STRING "true" also yields `true`, so comparing the unquoted value alone would let a payload
 * whose `success` is the string `"true"` be treated as a hold here while `receiptHoldsStock`
 * rejects it - reintroducing exactly the discovery/recheck disagreement this file exists to
 * prevent. MySQL keeps JSON BOOLEAN distinct from JSON STRING until the value is unquoted.
 *
 * Built from the same three signed fields as `classifyReceiptHold`, and from nothing else.
 */
export function sqlReceiptHoldsStock(payloadColumn: SQL | Column): SQL {
  const isTrueBoolean = (name: string) => {
    const extracted = sql`json_extract(${payloadColumn}, '$.${sql.raw(name)}')`;
    return sql`(json_type(${extracted}) = 'BOOLEAN' AND json_unquote(${extracted}) = 'true')`;
  };
  return sql`(${isTrueBoolean("is_refunded")} OR ${isTrueBoolean("success")} OR ${isTrueBoolean("pending")})`;
}