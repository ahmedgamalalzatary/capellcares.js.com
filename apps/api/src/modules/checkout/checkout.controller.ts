import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { quoteCheckoutTotals, submitCheckout } from "./checkout.service.js";
import { CheckoutAmountChangedError } from "../orders/orders.service.js";
import { PromoConfirmationRequiredError, PromoRejectedError } from "../promos/promo-checkout.js";

const customerIdOf = (req: AuthenticatedRequest) => (req.user?.role === "customer" ? req.user.id : null);

export function checkoutController(req: AuthenticatedRequest, res: Response) {
  submitCheckout({
    ...req.body,
    customerId: customerIdOf(req)
  }, { idempotencyKey: req.get("idempotency-key") })
    .then(({ replayed, ...response }) => {
      res.status(replayed ? 200 : 201).json(response);
    })
    .catch((error: Error) => {
      if (error instanceof PromoRejectedError) {
        res.status(409).json({ code: "PROMO_REJECTED", message: error.message, promo: error.rejection });
        return;
      }
      if (error instanceof PromoConfirmationRequiredError) {
        res.status(409).json({ code: "PROMO_CONFIRMATION_REQUIRED", message: error.message, promo: error.promo });
        return;
      }
      if (error instanceof CheckoutAmountChangedError) {
        res.status(409).json({ code: "CHECKOUT_AMOUNT_CHANGED", message: error.message });
        return;
      }
      res.status(400).json({ message: error.message });
    });
}

/** The checkout price box for an area. A code that no longer applies still prices the cart (without it) and reports why. */
export function checkoutQuoteController(req: AuthenticatedRequest, res: Response) {
  quoteCheckoutTotals({ ...req.body, customerId: customerIdOf(req) })
    .then((quote) => res.json(quote))
    .catch((error: Error) => res.status(400).json({ message: error.message }));
}
