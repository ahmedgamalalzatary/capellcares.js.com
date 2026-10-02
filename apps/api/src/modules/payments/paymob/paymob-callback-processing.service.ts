import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { paymobCallbackInbox } from "@capella/database/drizzle/schema";
import { claimPaymobCallback, deferPaymobCallback, rejectPaymobCallback, PAYMOB_CALLBACK_LEASE_MS,
  type PaymobCallbackClaim } from "./paymob-callback.repository.js";
import { parsePaymobProcessedCallback } from "./paymob-callback.js";
import { resolvePaymobConfig } from "./paymob-config.js";
import { createPaymobInquiryClient, type PaymobInquiry } from "./paymob-inquiry.client.js";
import { processPaymobTransaction } from "./paymob-transaction.service.js";

export type PaymobCallbackProcessingOptions = {
  now?: Date;
  inquiryLookup?: (transactionId: string) => Promise<PaymobInquiry>;
};
let cachedInquiry: { key: string; query: (id: string) => Promise<PaymobInquiry> } | undefined;
function inquiryLookup() {
  const config = resolvePaymobConfig();
  if (!config.apiKey) throw new Error("Paymob inquiry API key is unavailable");
  const key = `${config.baseUrl}|${config.apiKey}`;
  if (cachedInquiry?.key !== key) {
    const client = createPaymobInquiryClient({ baseUrl: config.baseUrl, apiKey: config.apiKey });
    cachedInquiry = { key, query: id => client.query(id) };
  }
  return cachedInquiry.query;
}

export async function processPaymobCallbackClaim(claim: PaymobCallbackClaim, options: PaymobCallbackProcessingOptions = {}) {
  const now = () => options.now ?? new Date();
  const payload = claim.normalizedPayload as Record<string, unknown>;
  const transaction = parsePaymobProcessedCallback({ ...payload, source_data: { type: payload.payment_method } });
  // Version 3 is the current fingerprint definition. Versions 1 and 2 remain processable:
  // receipts already durably stored under the older definitions carry the same normalized
  // payload shape and must still reach an outcome rather than be rejected outright. A row
  // written under a definition this code no longer understands would have to be rejected, so
  // any FUTURE version must be added here explicitly rather than assumed compatible.
  if (claim.callbackType !== "transaction" || ![1, 2, 3].includes(claim.fingerprintVersion) || !transaction) {
    await rejectPaymobCallback(claim, "PAYMENT_CALLBACK_INVALID", now());
    return false;
  }
  try {
    let verified: { is_refunded: boolean; refunded_amount_cents: number; environment: "test" | "live" } | undefined;
    if (transaction.is_refunded) {
      const inquiry = await (options.inquiryLookup ?? inquiryLookup())(String(transaction.id));
      // The authenticated read must describe the SAME payment the signed callback describes.
      // `order.id` and `integration_id` are both covered by Paymob's HMAC, so a mismatch here
      // means the inquiry answered about a different transaction - applying its refund total
      // would move money on the strength of an unrelated read.
      if (inquiry.transactionId !== String(transaction.id) || inquiry.paymobOrderId !== String(transaction.order?.id ?? "") ||
        inquiry.integrationId !== Number(transaction.integration_id) ||
        inquiry.amountCents !== transaction.amount_cents ||
        inquiry.currency !== transaction.currency || !inquiry.success || inquiry.pending || !inquiry.refunded ||
        !Number.isSafeInteger(inquiry.refundedAmountCents) || inquiry.refundedAmountCents <= 0 ||
        inquiry.refundedAmountCents > transaction.amount_cents) {
        await deferPaymobCallback(claim, "REFUND_VERIFICATION_UNRESOLVED", now());
        return false;
      }
      // The environment comes from the AUTHENTICATED inquiry response, never from the
      // callback body: `is_live` is outside Paymob's HMAC input list, so the callback's own
      // copy of it is not evidence. The processor cross-checks it against the environment
      // recorded on the locked local attempt.
      verified = { is_refunded: true, refunded_amount_cents: inquiry.refundedAmountCents,
        environment: inquiry.environment };
    }
    const result = await processPaymobTransaction(transaction, { verified, audit: { transaction },
      inbox: { id: claim.id, claimedBy: claim.claimedBy, leaseMs: PAYMOB_CALLBACK_LEASE_MS, now: now() } });
    if (result.outcome === "unmatched") await deferPaymobCallback(claim, "PAYMENT_BINDING_UNRESOLVED", now());
    return ["succeeded", "refunded", "failed", "pending", "refund_pending_success"].includes(result.outcome);
  } catch {
    await deferPaymobCallback(claim, transaction.is_refunded ? "REFUND_VERIFICATION_UNAVAILABLE" : "PAYMENT_PROCESSING_FAILED", now());
    return false;
  }
}

export async function processPaymobCallbackReceipt(id: number, options: PaymobCallbackProcessingOptions = {}) {
  const claim = await claimPaymobCallback({ id, now: options.now });
  if (claim) return processPaymobCallbackClaim(claim, options);
  const [row] = await db.select({ status: paymobCallbackInbox.processingStatus }).from(paymobCallbackInbox)
    .where(eq(paymobCallbackInbox.id, id)).limit(1);
  return row?.status === "processed";
}
