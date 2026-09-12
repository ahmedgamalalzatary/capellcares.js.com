import type { Request, Response } from "express";
import { resolvePaymobConfig } from "./paymob-config.js";
import { verifyPaymobTransactionHmac } from "./paymob-hmac.js";
import { recordPaymobTransaction } from "./paymob-webhook.service.js";
import { processPaymobTransaction } from "./paymob-transaction.service.js";
import { parsePaymobProcessedCallback } from "./paymob-callback.js";

export async function paymobWebhookController(req: Request, res: Response): Promise<void> {
  const hmac = typeof req.query.hmac === "string" ? req.query.hmac : "";
  const transaction = req.body?.type === "TRANSACTION" && req.body.obj && typeof req.body.obj === "object"
    ? req.body.obj
    : {};
  const secret = resolvePaymobConfig().hmacSecret ?? "";
  if (!verifyPaymobTransactionHmac({ transaction, receivedHmac: hmac, secret })) {
    res.status(401).json({ message: "Invalid Paymob callback signature" });
    return;
  }
  const parsedTransaction = parsePaymobProcessedCallback(transaction);
  if (!parsedTransaction) {
    res.status(422).json({ message: "Invalid Paymob transaction callback" });
    return;
  }
  const result = await processPaymobTransaction(parsedTransaction);
  const processed = result.outcome === "succeeded" || result.outcome === "refunded" ||
    result.outcome === "failed" || result.outcome === "pending";
  await recordPaymobTransaction(parsedTransaction, processed ? "processed" : "rejected");
  if (processed) {
    res.status(200).json({ received: true });
    return;
  }
  res.status(202).json({ received: true });
}
