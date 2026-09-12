import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { PaymobUnavailableError, submitCheckout } from "./checkout.service.js";
import { PaymobProviderError } from "../payments/paymob/paymob-client.js";

export function checkoutController(req: AuthenticatedRequest, res: Response) {
  submitCheckout({
    ...req.body,
    customerId: req.user?.role === "customer" ? req.user.id : null
  }, { idempotencyKey: req.get("idempotency-key") })
    .then((order) => res.status(201).json(order))
    .catch((error: Error) => {
      if (error instanceof PaymobUnavailableError) {
        res.status(503).json({ message: error.message });
        return;
      }
      if (error instanceof PaymobProviderError) {
        res.status(502).json({ message: "Payment provider is temporarily unavailable" });
        return;
      }
      res.status(400).json({ message: error.message });
    });
}
