import type { Response } from "express";
import { checkoutShippingQuoteRequestSchema } from "@capella/shared";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { checkoutShippingServiceFromEnvironment } from "./checkout-shipping-runtime.js";
import { CheckoutShippingError } from "./checkout-shipping.service.js";
import { ShippingUnsupportedDestinationError } from "./bosta/bosta-quote.service.js";
import { priceCheckout } from "../orders/orders.service.js";
import { ZodError } from "zod";

export function shippingErrorResponse(error: unknown, res: Response) {
  if (error instanceof ZodError) {
    res.status(400).json({ code: "SHIPPING_UNSUPPORTED", message: "Select a valid delivery destination and cart" });
    return;
  }
  const failure = error instanceof CheckoutShippingError ? error
    : new CheckoutShippingError(error instanceof ShippingUnsupportedDestinationError ? "SHIPPING_UNSUPPORTED" : "SHIPPING_UNAVAILABLE");
  res.status(failure.status).json({ code: failure.code, message: failure.message });
}

export async function checkoutShippingAvailabilityController(_req: AuthenticatedRequest, res: Response) {
  try {
    const service = checkoutShippingServiceFromEnvironment();
    res.json({ enabled: service != null, addresses: service ? await service.listDestinations() : [] });
  } catch (error) { shippingErrorResponse(error, res); }
}

export async function checkoutShippingQuoteController(req: AuthenticatedRequest, res: Response) {
  try {
    const service = checkoutShippingServiceFromEnvironment();
    if (!service) throw new CheckoutShippingError("SHIPPING_UNAVAILABLE");
    const request = { ...checkoutShippingQuoteRequestSchema.parse(req.body), customerId: req.user?.role === "customer" ? req.user.id : null };
    // Product prices, discounts and bundle contents come from the database.
    const priced = await priceCheckout(request);
    res.status(201).json(await service.quoteCheckout(request, priced));
  } catch (error) { shippingErrorResponse(error, res); }
}
