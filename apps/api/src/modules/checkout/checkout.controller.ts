import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { PaymobMinimumError, PaymobUnavailableError, submitCheckout } from "./checkout.service.js";
import { PaymobProviderError } from "../payments/paymob/paymob-client.js";
import { CheckoutAmountChangedError } from "../orders/orders.service.js";
import { CheckoutShippingError } from "../shipping/checkout-shipping.service.js";
import { PaymentEvidenceUnresolvedError } from "./paymob-checkout.service.js";
import { PromoRejectedError } from "../promos/promo-checkout.js";

export function checkoutController(req: AuthenticatedRequest, res: Response) {
  submitCheckout({
    ...req.body,
    customerId: req.user?.role === "customer" ? req.user.id : null
  }, { idempotencyKey: req.get("idempotency-key") })
    .then((order) => {
      if (order.kind === "cod_order") {
        const { replayed, ...response } = order;
        res.status(replayed ? 200 : 201).json(response);
        return;
      }
      res.status(201).json(order);
    })
    .catch((error: Error) => {
      if (error instanceof PaymentEvidenceUnresolvedError) {
        res.status(409).json({ code: error.code, message: error.message });
        return;
      }
      if (error instanceof CheckoutShippingError) {
        res.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      if (error instanceof PaymobMinimumError) {
        res.status(400).json({ code: "PAYMENT_MINIMUM", message: error.message });
        return;
      }
      if (error instanceof PaymobUnavailableError) {
        res.status(503).json({ code: "PAYMENT_UNAVAILABLE", message: error.message });
        return;
      }
      if (error instanceof PaymobProviderError) {
        res.status(502).json({ code: "PAYMENT_UNAVAILABLE", message: "Payment provider is temporarily unavailable" });
        return;
      }
      if (error instanceof PromoRejectedError) {
        res.status(409).json({ code: "PROMO_REJECTED", message: error.message, promo: error.rejection });
        return;
      }
      if (error instanceof CheckoutAmountChangedError) {
        res.status(409).json({ code: "CHECKOUT_AMOUNT_CHANGED", message: error.message });
        return;
      }
      res.status(400).json({ message: error.message });
    });
}
