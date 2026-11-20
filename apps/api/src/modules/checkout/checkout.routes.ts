import { Router } from "express";
import { checkoutController, checkoutQuoteController } from "./checkout.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { parseCheckoutBody, parseCheckoutQuoteBody } from "./checkout.schemas.js";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";
import { wrapAsync } from "../../lib/async-route.js";
import { checkoutPriceController, limitPromoAttempts } from "../promos/checkout-price.controller.js";

export const checkoutRoutes = Router();
const checkoutLimit = rateLimit({ keyPrefix: "checkout", windowMs: 10 * 60 * 1000, max: 20 });

// Every request that checks a typed promo code shares one guessing limit (docs/promo-codes-spec.md section 9.4).
checkoutRoutes.post("/", checkoutLimit, optionalAuthMiddleware, limitPromoAttempts, validateBody(parseCheckoutBody), checkoutController);

// Read-only pricing for the checkout page; looser limit because it runs as the customer edits the cart or area.
const quoteLimit = rateLimit({ keyPrefix: "checkout-quote", windowMs: 60 * 1000, max: 60 });
checkoutRoutes.post("/quote", quoteLimit, optionalAuthMiddleware, limitPromoAttempts, validateBody(parseCheckoutQuoteBody), checkoutQuoteController);

// The cart priced by the server, with the promo code applied (the cart has no delivery area yet).
const priceLimit = rateLimit({ keyPrefix: "checkout-price", windowMs: 60 * 1000, max: 60 });
checkoutRoutes.post("/price", priceLimit, optionalAuthMiddleware, limitPromoAttempts, wrapAsync(checkoutPriceController));
