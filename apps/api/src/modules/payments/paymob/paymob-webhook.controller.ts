import type { Request, Response } from "express";
import { resolvePaymobConfig } from "./paymob-config.js";
import { verifyPaymobTransactionHmac } from "./paymob-hmac.js";
import { receivePaymobCallback } from "./paymob-webhook.service.js";
import { parsePaymobProcessedCallback } from "./paymob-callback.js";
import type { PaymobInquiry } from "./paymob-inquiry.client.js";
import { processPaymobCallbackReceipt } from "./paymob-callback-processing.service.js";

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
  // Durable intake FIRST. Once a callback is signature-verified it is recorded before any
  // processing, so a crash or a provider outage cannot lose a notification Paymob already
  // considers delivered.
  const receipt = await receivePaymobCallback({ callbackType: "transaction", transaction: parsedTransaction });
  // Inline processing and scheduled recovery use the same claim and atomic commit.
  // A concurrent duplicate cannot reopen a completed receipt or steal a fresh lease.
  const processed = await processPaymobCallbackReceipt(receipt.id, { inquiryLookup: inquiryLookup ?? undefined });
  if (processed) {
    res.status(200).json({ received: true });
    return;
  }
  res.status(202).json({ received: true });
}
