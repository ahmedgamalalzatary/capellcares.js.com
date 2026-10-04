import { resolvePaymobConfig } from "./paymob-config.js";
import { createPaymobInquiryClient, PaymobInquiryError, type PaymobOrderInquiry } from "./paymob-inquiry.client.js";
import { processPaymobTransaction } from "./paymob-transaction.service.js";
import { applyReconcileOutcome, claimReconcileAttempt, discoverDueReconcileAttemptIds,
  RECONCILE_MAX_ATTEMPTS, type ReconcileClaim } from "./paymob-reconciliation.repository.js";

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 60_000;
function retryDelay(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(5, Math.max(0, attempts - 1)));
}

/** Trusted outcomes settlement may report for an authenticated inquiry; anything else is unresolved and must not release stock. */
const RECOVERED_OUTCOMES = new Set(["succeeded", "refunded", "refund_pending_success"]);

let cachedInquiry: { key: string; query: (orderId: string) => Promise<PaymobOrderInquiry> } | undefined;
function defaultInquiry() {
  const config = resolvePaymobConfig();
  if (!config.apiKey) throw new PaymobInquiryError("PAYMENT_INQUIRY_UNAVAILABLE", "Paymob inquiry API key is unavailable");
  const key = `${config.baseUrl}|${config.apiKey}`;
  if (cachedInquiry?.key !== key) {
    const client = createPaymobInquiryClient({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    cachedInquiry = { key, query: (orderId) => client.queryByOrderId(orderId) };
  }
  return cachedInquiry.query;
}

export type ReconcileOptions = {
  now?: Date;
  /** Injectable trusted read, so the sweep is testable without the provider. */
  inquiryByOrderId?: (orderId: string) => Promise<PaymobOrderInquiry>;
  /** Injectable settlement; defaults to the shared atomic payment settlement so a recovered payment follows exactly the same rules as a callback. */
  settle?: typeof processPaymobTransaction;
};

/** Claims and reconciles one due attempt. Returns true when an attempt was processed (whether it resolved or was rescheduled), false when nothing was due. */
export async function runPaymobReconciliationOnce(options: ReconcileOptions = {}): Promise<boolean> {
  const now = options.now ?? new Date();
  const [attemptId] = await discoverDueReconcileAttemptIds(now, 1);
  if (attemptId === undefined) return false;
  const claim = await claimReconcileAttempt(attemptId, now);
  if (!claim) return false;
  await reconcileClaim(claim, options, now);
  return true;
}

async function reconcileClaim(claim: ReconcileClaim, options: ReconcileOptions, now: Date): Promise<void> {
  let inquiry: PaymobOrderInquiry;
  try {
    inquiry = await (options.inquiryByOrderId ?? defaultInquiry())(claim.paymobOrderId);
  } catch (error) {
    // An authenticated "no transaction" is a resolved fact (safe to release); every other failure is unresolved (hold and retry).
    if (error instanceof PaymobInquiryError && error.code === "PAYMENT_INQUIRY_NOT_FOUND") {
      await applyReconcileOutcome(claim, { kind: "no_payment", reason: "PAYMENT_INQUIRY_NOT_FOUND" }, now);
    } else {
      await retryOrPark(claim, error instanceof PaymobInquiryError ? error.code : "PAYMENT_INQUIRY_UNAVAILABLE", now);
    }
    return;
  }
  // The read is keyed on OUR stored order id; a response naming another order cannot describe this attempt.
  if (inquiry.paymobOrderId !== claim.paymobOrderId) {
    await retryOrPark(claim, "PAYMENT_INQUIRY_IDENTITY_MISMATCH", now);
    return;
  }
  const raw = inquiry.rawTransaction;
  // A refund against a payment we never settled needs a base order we do not have; that is staff work, never an automatic path.
  if (inquiry.refunded) { await retryOrPark(claim, "PAYMENT_INQUIRY_REFUND_UNRESOLVED", now); return; }
  // An authorisation can still capture, so it is money in flight rather than a decline.
  if (raw.is_auth === true) { await retryOrPark(claim, "PAYMENT_INQUIRY_AUTHORIZATION_PENDING", now); return; }
  if (inquiry.pending) { await retryOrPark(claim, "PAYMENT_INQUIRY_PENDING", now); return; }
  if (!inquiry.success) {
    // The provider authenticated the read and reports a completed, non-successful transaction: nothing was paid.
    await applyReconcileOutcome(claim, { kind: "no_payment", reason: "PAYMENT_INQUIRY_DECLINED" }, now);
    return;
  }
  let outcome: Awaited<ReturnType<typeof processPaymobTransaction>>;
  try {
    outcome = await (options.settle ?? processPaymobTransaction)(raw, { verified: { environment: inquiry.environment } });
  } catch {
    await retryOrPark(claim, "PAYMENT_RECONCILIATION_FAILED", now);
    return;
  }
  if (RECOVERED_OUTCOMES.has(outcome.outcome)) {
    await applyReconcileOutcome(claim, { kind: "recovered" }, now);
    return;
  }
  if (outcome.outcome === "failed") {
    await applyReconcileOutcome(claim, { kind: "no_payment", reason: "PAYMENT_INQUIRY_DECLINED" }, now);
    return;
  }
  if (outcome.outcome === "pending") { await retryOrPark(claim, "PAYMENT_INQUIRY_PENDING", now); return; }
  // Anything else (rejected/unmatched/reconciliation_required) needs a human: park rather than guess.
  await retryOrPark(claim, `PAYMENT_INQUIRY_${outcome.outcome.toUpperCase()}`, now);
}

async function retryOrPark(claim: ReconcileClaim, reason: string, now: Date): Promise<void> {
  const attempts = claim.attempts + 1;
  if (attempts >= RECONCILE_MAX_ATTEMPTS) {
    await applyReconcileOutcome(claim, { kind: "park", reason }, now);
    return;
  }
  await applyReconcileOutcome(claim, { kind: "retry", reason, nextAt: new Date(now.getTime() + retryDelay(attempts)) }, now);
}
