import { Router } from "express";
import { checkoutController } from "./checkout.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { parseCheckoutBody } from "./checkout.schemas.js";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/rate-limit.middleware.js";

export const checkoutRoutes = Router();
const checkoutLimit = rateLimit({ keyPrefix: "checkout", windowMs: 10 * 60 * 1000, max: 20 });

checkoutRoutes.post("/", checkoutLimit, optionalAuthMiddleware, validateBody(parseCheckoutBody), checkoutController);
