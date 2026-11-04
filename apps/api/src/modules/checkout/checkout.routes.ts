import { Router } from "express";
import { checkoutController, checkoutQuoteController } from "./checkout.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { parseCheckoutBody, parseCheckoutQuoteBody } from "./checkout.schemas.js";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";

export const checkoutRoutes = Router();
const checkoutLimit = rateLimit({ keyPrefix: "checkout", windowMs: 10 * 60 * 1000, max: 20 });

checkoutRoutes.post("/", checkoutLimit, optionalAuthMiddleware, validateBody(parseCheckoutBody), checkoutController);

// Read-only pricing for the checkout page; looser limit because it runs as the customer edits the cart or area.
const quoteLimit = rateLimit({ keyPrefix: "checkout-quote", windowMs: 60 * 1000, max: 60 });
checkoutRoutes.post("/quote", quoteLimit, validateBody(parseCheckoutQuoteBody), checkoutQuoteController);
