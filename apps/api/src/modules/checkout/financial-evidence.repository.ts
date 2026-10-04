import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { paymentAttempts, paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { payloadSignedOrderId, receiptHoldsStock } from "./receipt-hold-policy.js";

/** Inbox states that still represent work a worker has not finished. */
export const UNRESOLVED_INBOX_STATUSES = ["received", "processing", "failed", "review_required"] as const;

/** Attempt states that mean the attempt is still legitimately in play. */
export const OPEN_ATTEMPT_STATUSES = ["created", "pending"] as const;

/** Provider order ids that have durably-received but unresolved payment evidence.
 * Scoped to the ids the caller cares about and correlated in SQL against the indexed `signed_order_id` scalar, not a JSON extraction: the earlier whole-inbox scan under a fixed limit let an unrelated backlog silently hide a real match for THIS order (and made the failure invisible) — callers know their own ids, so the lookup is exact instead of best-effort. */
export async function unresolvedInboxOrderIds(candidateOrderIds: readonly string[],
  options: { tx?: Pick<typeof db, "select">; excludeInboxId?: number } = {}): Promise<Set<string>> {
  if (candidateOrderIds.length === 0) return new Set();
  const rows = await (options.tx ?? db)
    .select({ orderId: paymobCallbackInbox.signedOrderId, payload: paymobCallbackInbox.normalizedPayload })
    .from(paymobCallbackInbox)
    .where(and(
      inArray(paymobCallbackInbox.processingStatus, [...UNRESOLVED_INBOX_STATUSES]),
      options.excludeInboxId === undefined ? undefined : ne(paymobCallbackInbox.id, options.excludeInboxId),
      // Match on EITHER the indexed scalar or the signed id still living in the payload — filtering on the scalar alone would exclude the very un-backfilled rows the payload fallback exists to rescue, so the OR is required, not merely a safety net.
      or(inArray(paymobCallbackInbox.signedOrderId, [...candidateOrderIds]),
        sql`json_unquote(json_extract(${paymobCallbackInbox.normalizedPayload}, '$.order.id')) in (${sql.join(candidateOrderIds.map((id) => sql`${id}`), sql`, `)})`)
    ));
  const ids = new Set<string>();
  for (const row of rows) {
    // `signed_order_id` is indexed and authoritative but NULL for every row predating migration 0063 until the backfill runs; falling back to the signed id inside the payload closes that upgrade window (reading only the scalar would miss those receipts and report a paid checkout as unevidenced, so expiry releases stock already paid for) — `order.id` is HMAC-covered so it stays trustworthy while unindexed, and is only consulted when the scalar is absent.
    const orderId = row.orderId ?? payloadSignedOrderId(row.payload);
    // Only an id the caller asked about may be returned. A row naming some other order, or naming none at all, must not widen the caller's evidence set.
    if (orderId === null || !candidateOrderIds.includes(orderId)) continue;
    // Unresolved is not the same as actionable — a decline that reached review_required can never become money, so holding stock on it strands an abandoned session's reservation indefinitely; the typed policy decides from signed fields only.
    if (receiptHoldsStock(row.payload)) ids.add(orderId);
  }
  return ids;
}

/** True when a checkout session has payment evidence durably received but not yet resolved — the single shared definition of "unresolved financial evidence" (P03/P04) that reservation expiry, customer retry, shipping dispatch and the payment effects must all consult, so they cannot disagree about whether a payment is in flight.
 * Correlation is two-sided and local (an inbox row counts only when it names a signed id an attempt of THIS session holds); call it while holding the session lock, but it MUST stay lock-free (W06 problem 2) — it is the one helper both session-first payment and order-first shipping paths need, so a lock of its own would complete the session/order cycle. Guard queries take no locks; status/discovery reads are advisory and rechecked under the shared lock; stronger guarantees need a `lockOrder` note and concurrency test rather than `.for("update")`. */
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

/** Sessions with unresolved payment evidence, for staff reconciliation and any caller needing the whole set; the lookup is driven by the attempt table rather than the inbox — the provider order ids worth asking about are the ones an open attempt holds, a much smaller and more meaningful input than scanning the inbox wholesale. */
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
