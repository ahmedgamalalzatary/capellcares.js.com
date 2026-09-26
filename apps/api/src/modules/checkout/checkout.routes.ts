import { Router } from "express";
import { checkoutController } from "./checkout.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { parseCheckoutBody } from "./checkout.schemas.js";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { wrapAsync } from "../../lib/async-route.js";
import { getCheckoutStatusController } from "./checkout-status.controller.js";
import { retryCheckoutController } from "./checkout-retry.controller.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { checkoutShippingAvailabilityController, checkoutShippingQuoteController } from "../shipping/checkout-shipping.controller.js";

export const checkoutRoutes = Router();
const checkoutLimit = rateLimit({ keyPrefix: "checkout", windowMs: 10 * 60 * 1000, max: 20 });
const checkoutStatusLimit = rateLimit({ keyPrefix: "checkout-status", windowMs: 60 * 1000, max: 120,
  key: (req) => `${req.ip ?? "unknown"}:${req.params.checkoutId ?? "unknown"}` });
const checkoutRetryLimit = rateLimit({ keyPrefix: "checkout-retry", windowMs: 10 * 60 * 1000, max: 10,
  key: (req) => `${req.ip ?? "unknown"}:${req.params.checkoutId ?? "unknown"}` });

checkoutRoutes.post("/", checkoutLimit, optionalAuthMiddleware, validateBody(parseCheckoutBody), checkoutController);
const shippingQuoteLimit = rateLimit({ keyPrefix: "shipping-quote", windowMs: 60 * 1000, max: 30 });
checkoutRoutes.get("/shipping", shippingQuoteLimit, wrapAsync(checkoutShippingAvailabilityController));
checkoutRoutes.post("/shipping/quote", shippingQuoteLimit, optionalAuthMiddleware, wrapAsync(checkoutShippingQuoteController));
checkoutRoutes.get("/:checkoutId/status", checkoutStatusLimit, wrapAsync(getCheckoutStatusController));
checkoutRoutes.post("/:checkoutId/retry", checkoutRetryLimit, wrapAsync(retryCheckoutController));
