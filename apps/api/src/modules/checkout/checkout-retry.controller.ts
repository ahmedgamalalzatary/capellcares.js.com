import type { Request, Response } from "express";
import { resolvePaymobConfig } from "../payments/paymob/paymob-config.js";
import { retryPaymobCheckout } from "./paymob-checkout.service.js";
import { PaymobProviderError } from "../payments/paymob/paymob-client.js";

export async function retryCheckoutController(req: Request, res: Response): Promise<void> {
  const config = resolvePaymobConfig();
  const notificationUrl = process.env.PAYMOB_NOTIFICATION_URL?.trim();
  const redirectionUrl = process.env.PAYMOB_REDIRECTION_URL?.trim();
  if (!config.canInitiatePayments || !notificationUrl || !redirectionUrl) {
    res.status(503).json({ message: "Paymob checkout is not configured" });
    return;
  }
  try {
    const result = await retryPaymobCheckout({
      checkoutId: req.params.checkoutId,
      config,
      notificationUrl,
      redirectionUrl
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof PaymobProviderError) {
      res.status(502).json({ message: "Payment provider is temporarily unavailable" });
      return;
    }
    if (error instanceof Error && error.message === "Checkout not found") {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error instanceof Error && ["Checkout is no longer payable", "Payment attempt limit reached",
      "Previous payment attempt has not failed"].includes(error.message)) {
      res.status(409).json({ message: error.message });
      return;
    }
    throw error;
  }
}
