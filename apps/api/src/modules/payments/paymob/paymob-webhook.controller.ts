import type { Request, Response } from "express";
import { resolvePaymobConfig } from "./paymob-config.js";
import { verifyPaymobTransactionHmac } from "./paymob-hmac.js";
import { recordPaymobTransaction } from "./paymob-webhook.service.js";
import { processPaymobTransaction } from "./paymob-transaction.service.js";
import { parsePaymobProcessedCallback } from "./paymob-callback.js";
import { createPaymobInquiryClient, type PaymobInquiry } from "./paymob-inquiry.client.js";

/**
 * Injectable seam so route tests never reach the network. Injected per-request by the
 * test app; production leaves it unset and gets the real authenticated client.
 */
let inquiryLookup: ((transactionId: string) => Promise<PaymobInquiry>) | null = null;

/** Test-only: install a stand-in for the authenticated transaction inquiry. */
export function setPaymobInquiryLookupForTests(
  lookup: ((transactionId: string) => Promise<PaymobInquiry>) | null
): void {
  inquiryLookup = lookup;
}

/**
 * Authenticated refund evidence for a callback.
 *
 * `refunded_amount_cents` is not covered by Paymob's HMAC, so it is only ever trusted
 * when the provider confirms it. An inquiry outage is NOT treated as "no refund" and
 * NOT treated as an error the buyer sees: the callback is still acknowledged, and any
 * refund effect simply cannot be applied from an unverified number. Returning null means
 * "no evidence", which makes a refund callback resolve to `rejected` downstream rather
 * than to a forged total.
 */
async function verifiedRefundEvidence(
  config: ReturnType<typeof resolvePaymobConfig>, transaction: Record<string, unknown>
): Promise<{ is_refunded?: boolean; refunded_amount_cents?: number | null } | null> {
  // Only a callback that CLAIMS a refund needs the authenticated read.
  //
  // `is_refunded` IS covered by Paymob's HMAC, so by the time we get here the flag is
  // trustworthy; only the refund AMOUNT is not. Inquiring on every successful payment
  // cost a provider round trip per order for a value that callback could never have
  // contributed, and it put the whole payment path at the mercy of the inquiry endpoint.
  if (transaction.is_refunded !== true) return null;
  const transactionId = transaction.id;
  if (transactionId === undefined || transactionId === null) return null;
  try {
    const lookup = inquiryLookup ?? cachedInquiryLookup(config);
    const inquiry = await lookup(String(transactionId));
    return { is_refunded: inquiry.refunded, refunded_amount_cents: inquiry.refundedAmountCents };
  } catch {
    // Provider unreachable or unparseable: no trusted evidence, and no guess.
    return null;
  }
}

/**
 * Memoised production inquiry client, keyed by endpoint and secret.
 *
 * The client was previously rebuilt for every single callback. A module-level cache keeps
 * one client per configuration, so the cost is paid once per configuration rather than once
 * per payment.
 */
let cachedLookup: { key: string; lookup: (transactionId: string) => Promise<PaymobInquiry> } | null = null;

function cachedInquiryLookup(config: ReturnType<typeof resolvePaymobConfig>) {
  if (!config.secretKey) throw new Error("Paymob secret key is not configured");
  const key = `${config.baseUrl}|${config.secretKey}`;
  if (cachedLookup?.key !== key) {
    const client = createPaymobInquiryClient({ baseUrl: config.baseUrl, secretKey: config.secretKey });
    cachedLookup = { key, lookup: (transactionId: string) => client.query(transactionId) };
  }
  return cachedLookup.lookup;
}

export async function paymobWebhookController(req: Request, res: Response): Promise<void> {
  const hmac = typeof req.query.hmac === "string" ? req.query.hmac : "";
  const transaction = req.body?.type === "TRANSACTION" && req.body.obj && typeof req.body.obj === "object"
    ? req.body.obj
    : {};
  const config = resolvePaymobConfig();
  const secret = config.hmacSecret ?? "";
  if (!verifyPaymobTransactionHmac({ transaction, receivedHmac: hmac, secret })) {
    res.status(401).json({ message: "Invalid Paymob callback signature" });
    return;
  }
  const parsedTransaction = parsePaymobProcessedCallback(transaction);
  if (!parsedTransaction) {
    res.status(422).json({ message: "Invalid Paymob transaction callback" });
    return;
  }
  const verified = await verifiedRefundEvidence(config, parsedTransaction);
  // `audit` makes the outcome commit inside the same transaction as the payment itself,
  // so a crash cannot leave a paid order with no audit trail.
  const result = await processPaymobTransaction(parsedTransaction, { verified: verified ?? undefined,
    audit: { transaction: parsedTransaction } });
  const processed = result.outcome === "succeeded" || result.outcome === "refunded" ||
    result.outcome === "failed" || result.outcome === "pending" || result.outcome === "refund_pending_success";
  if (processed) {
    res.status(200).json({ received: true });
    return;
  }
  res.status(202).json({ received: true });
}
