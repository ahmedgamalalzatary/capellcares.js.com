import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { quoteCheckoutTotals, submitCheckout } from "./checkout.service.js";
import { CheckoutAmountChangedError } from "../orders/orders.service.js";

export function checkoutController(req: AuthenticatedRequest, res: Response) {
  submitCheckout({
    ...req.body,
    customerId: req.user?.role === "customer" ? req.user.id : null
  }, { idempotencyKey: req.get("idempotency-key") })
    .then(({ replayed, ...response }) => {
      res.status(replayed ? 200 : 201).json(response);
    })
    .catch((error: Error) => {
      if (error instanceof CheckoutAmountChangedError) {
        res.status(409).json({ code: "CHECKOUT_AMOUNT_CHANGED", message: error.message });
        return;
      }
      res.status(400).json({ message: error.message });
    });
}

export function checkoutQuoteController(req: AuthenticatedRequest, res: Response) {
  quoteCheckoutTotals(req.body)
    .then((quote) => res.json(quote))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
