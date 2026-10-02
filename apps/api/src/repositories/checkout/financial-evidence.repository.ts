import { and, eq, inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { paymentAttempts, paymobCallbackInbox } from "@capella/database/drizzle/schema";

/** Inbox states that still represent work a worker has not finished. */
export const UNRESOLVED_INBOX_STATUSES = ["received", "processing", "failed"] as const;

/** Attempt states that mean the attempt is still legitimately in play. */
export const OPEN_ATTEMPT_STATUSES = ["created", "pending"] as const;

/**
 * The signed provider order id inside a stored inbox payload.
 *
 * `order.id` IS covered by Paymob's HMAC, so unlike `refunded_amount_cents` it is
 * trustworthy for correlation. It is deliberately the ONLY payload field any decision
 * here is allowed to read: this module answers "is something still pending", never "what
 * does it claim". Interpreting a claim requires an authenticated provider inquiry, which
 * belongs to the payment worker, not to a guard query.
 */
function signedOrderId(payload: unknown): string | null {
  const order = (payload as { order?: { id?: unknown } } | null)?.order;
  const id = order?.id;
  return id === undefined || id === null ? null : String(id);
}

/**
 * Provider order ids that have durably-received but unresolved payment evidence.
 *
 * Correlation happens in application code rather than in SQL JSON functions on purpose:
 * the engine here is MySQL 8.4, which has neither `JSON_UNNEST` nor MariaDB's
 * `IS NOT NULL(expr)` form, and the set is bounded by the inbox backlog.
 */
export async function unresolvedInboxOrderIds(limit = 1000): Promise<Set<string>> {
  const rows = await db
    .select({ payload: paymobCallbackInbox.normalizedPayload })
    .from(paymobCallbackInbox)
    .where(inArray(paymobCallbackInbox.processingStatus, [...UNRESOLVED_INBOX_STATUSES]))
    .limit(limit);
  const ids = new Set<string>();
  for (const row of rows) {
    const orderId = signedOrderId(row.payload);
    if (orderId !== null) ids.add(orderId);
  }
  return ids;
}

/**
 * True when a checkout session has payment evidence that has been durably received but
 * not yet resolved.
 *
 * This is the single shared definition of "unresolved financial evidence" (P03/P04).
 * Every caller that could otherwise act on incomplete payment information — reservation
 * expiry, customer retry, shipping dispatch, and the payment effects themselves — must
 * consult it, so those paths cannot disagree about whether a payment is still in flight.
 *
 * Correlation is two-sided and local: an inbox row only counts when it names a signed
 * provider order id that an attempt of THIS session actually holds. A forged or unknown
 * reference therefore matches nothing and asserts nothing.
 *
 * Call this while holding the session lock. The answer is a read, not a claim: another
 * worker may still be applying the effects it describes.
 *
 * LOCK ORDER (W06 problem 2). This function MUST stay lock-free. It is the one helper
 * that both the session-first payment paths AND the order-first shipping paths need, so
 * if it ever took a lock of its own it would inherit a cycle the moment dispatch starts
 * consulting it: payment holds session and wants order, shipping holds order and wants
 * the evidence. Neither could proceed.
 *
 * The safe discipline it relies on:
 *   - The inbox read is outside every lock; `unresolvedOrderIds` is fetched first.
 *   - The attempt read below is a plain SELECT inside the caller's existing transaction,
 *     so it adds no new lock edge and follows whatever order the caller already uses.
 *
 * If a future change needs stronger guarantees here, add a `lockOrder` note and the
 * corresponding concurrency test rather than reaching for `.for("update")`.
 *
 * `tx` is narrowed to `select` only: `for("update")` lives on the query result rather
 * than the session, so this cannot fully forbid a lock at the type level, but it records
 * the contract where a future edit is most likely to look.
 */
export async function hasUnresolvedFinancialEvidence(
  tx: Pick<typeof db, "select">,
  checkoutSessionId: number,
  unresolvedOrderIds: Set<string>
): Promise<boolean> {
  if (unresolvedOrderIds.size === 0) return false;
  const attempts = await tx
    .select({ paymobOrderId: paymentAttempts.paymobOrderId, status: paymentAttempts.status })
    .from(paymentAttempts)
    .where(and(
      eq(paymentAttempts.checkoutSessionId, checkoutSessionId),
      inArray(paymentAttempts.status, [...OPEN_ATTEMPT_STATUSES])
    ));
  return attempts.some((attempt) => attempt.paymobOrderId !== null &&
    unresolvedOrderIds.has(String(attempt.paymobOrderId)));
}

/**
 * Sessions with unresolved payment evidence, for staff reconciliation and any future
 * caller that needs the whole set rather than one session.
 */
export async function sessionsWithUnresolvedEvidence(limit = 1000): Promise<Set<number>> {
  const unresolved = await unresolvedInboxOrderIds(limit);
  if (unresolved.size === 0) return new Set();
  const attempts = await db
    .select({ sessionId: paymentAttempts.checkoutSessionId, paymobOrderId: paymentAttempts.paymobOrderId })
    .from(paymentAttempts)
    .where(and(
      inArray(paymentAttempts.status, [...OPEN_ATTEMPT_STATUSES]),
      inArray(paymentAttempts.paymobOrderId, [...unresolved])
    ));
  return new Set(attempts.map((attempt) => attempt.sessionId));
}
