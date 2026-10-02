import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { paymentAttempts, paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { payloadSignedOrderId, receiptHoldsStock } from "./receipt-hold-policy.js";

/** Inbox states that still represent work a worker has not finished. */
export const UNRESOLVED_INBOX_STATUSES = ["received", "processing", "failed", "review_required"] as const;

/** Attempt states that mean the attempt is still legitimately in play. */
export const OPEN_ATTEMPT_STATUSES = ["created", "pending"] as const;

/**
 * Provider order ids that have durably-received but unresolved payment evidence.
 *
 * Scoped to the ids the caller actually cares about. The earlier version scanned the
 * whole inbox under a fixed limit, which was wrong twice over: it let an unrelated
 * backlog silently hide a real match for THIS order, and the limit made that failure
 * invisible. Callers know their own ids - the status controller and dispatch both hold
 * exactly the attempt rows they are judging - so the lookup is exact instead of best
 * effort.
 *
 * Correlation happens in SQL against the indexed `signed_order_id` scalar, not against a JSON
 * extraction over the payload. Extracting per candidate meant correctness depended on how
 * many inbox rows the engine happened to walk, so an unrelated backlog could hide a real
 * match for THIS order and silently release stock the customer had already paid for.
 */
export async function unresolvedInboxOrderIds(candidateOrderIds: readonly string[],
  options: { tx?: Pick<typeof db, "select">; excludeInboxId?: number } = {}): Promise<Set<string>> {
  if (candidateOrderIds.length === 0) return new Set();
  const rows = await (options.tx ?? db)
    .select({ orderId: paymobCallbackInbox.signedOrderId, payload: paymobCallbackInbox.normalizedPayload })
    .from(paymobCallbackInbox)
    .where(and(
      inArray(paymobCallbackInbox.processingStatus, [...UNRESOLVED_INBOX_STATUSES]),
      options.excludeInboxId === undefined ? undefined : ne(paymobCallbackInbox.id, options.excludeInboxId),
      // Match on EITHER the indexed scalar or the signed id still living in the payload.
      // Filtering on the scalar alone would exclude the very un-backfilled rows the payload
      // fallback exists to rescue, so the OR is required, not merely a safety net.
      or(inArray(paymobCallbackInbox.signedOrderId, [...candidateOrderIds]),
        sql`json_unquote(json_extract(${paymobCallbackInbox.normalizedPayload}, '$.order.id')) in (${sql.join(candidateOrderIds.map((id) => sql`${id}`), sql`, `)})`)
    ));
  const ids = new Set<string>();
  for (const row of rows) {
    // `signed_order_id` is indexed and authoritative, but it is NULL for every row that
    // predates migration 0063 until the backfill runs. Falling back to the signed id inside
    // the payload closes that upgrade window: reading only the scalar would miss those
    // receipts and report a paid checkout as unevidenced, so expiry releases stock the
    // customer already paid for. `order.id` is HMAC-covered, so it stays trustworthy while
    // unindexed, and it is only consulted when the scalar is absent.
    const orderId = row.orderId ?? payloadSignedOrderId(row.payload);
    // Only an id the caller asked about may be returned. A row naming some other order, or
    // naming none at all, must not widen the caller's evidence set.
    if (orderId === null || !candidateOrderIds.includes(orderId)) continue;
    // Unresolved is not the same as actionable. A decline that reached review_required can
    // never become money, so holding stock on it would strand an abandoned session's
    // reservation indefinitely. The typed policy decides, from signed fields only.
    if (receiptHoldsStock(row.payload)) ids.add(orderId);
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
 *   - Guard queries never acquire their own row locks. Mutation callers read
 *     inbox/attempt evidence on their existing transaction connection after the
 *     session/order lock, avoiding both stale pre-lock snapshots and pool starvation.
 *   - Status/discovery callers may read without a transaction; their answers are
 *     advisory and are rechecked by the mutation under the shared lock.
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
  unresolvedOrderIds: ReadonlySet<string>
): Promise<boolean> {
  if (unresolvedOrderIds.size === 0) return false;
  const attempts = await tx
    .select({ paymobOrderId: paymentAttempts.paymobOrderId, status: paymentAttempts.status })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, checkoutSessionId));
  return attempts.some((attempt) => attempt.paymobOrderId !== null &&
    unresolvedOrderIds.has(String(attempt.paymobOrderId)));
}

/** Every provider order id a session's attempts hold, for scoping an inbox lookup. */
export async function sessionPaymobOrderIds(
  tx: Pick<typeof db, "select">,
  checkoutSessionId: number
): Promise<string[]> {
  const attempts = await tx
    .select({ paymobOrderId: paymentAttempts.paymobOrderId })
    .from(paymentAttempts)
    .where(and(
      eq(paymentAttempts.checkoutSessionId, checkoutSessionId),
      isNotNull(paymentAttempts.paymobOrderId)
    ));
  return attempts.map((attempt) => String(attempt.paymobOrderId));
}

/**
 * Sessions with unresolved payment evidence, for staff reconciliation and any future
 * caller that needs the whole set rather than one session.
 *
 * The lookup is driven by the attempt table rather than the inbox: the set of provider
 * order ids actually worth asking about is the set an open attempt holds, which is a
 * much smaller and more meaningful input than scanning the inbox wholesale.
 */
export async function sessionsWithUnresolvedEvidence(limit = 1000): Promise<Set<number>> {
  const attempts = await db
    .select({ sessionId: paymentAttempts.checkoutSessionId, paymobOrderId: paymentAttempts.paymobOrderId })
    .from(paymentAttempts)
    .where(and(
      inArray(paymentAttempts.status, [...OPEN_ATTEMPT_STATUSES]),
      isNotNull(paymentAttempts.paymobOrderId)
    )).limit(limit);
  const ids = [...new Set(attempts.map((attempt) => String(attempt.paymobOrderId)))];
  const unresolved = await unresolvedInboxOrderIds(ids);
  if (unresolved.size === 0) return new Set();
  return new Set(attempts
    .filter((attempt) => unresolved.has(String(attempt.paymobOrderId)))
    .map((attempt) => attempt.sessionId));
}
