import { Router } from "express";
import { checkoutController } from "./checkout.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { parseCheckoutBody } from "./checkout.schemas.js";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";
import { wrapAsync } from "../../lib/async-route.js";
import { getCheckoutStatusController } from "./checkout-status.controller.js";
import { retryCheckoutController } from "./checkout-retry.controller.js";

export const checkoutRoutes = Router();
checkoutRoutes.post("/", optionalAuthMiddleware, validateBody(parseCheckoutBody), checkoutController);
checkoutRoutes.get("/:checkoutId/status", wrapAsync(getCheckoutStatusController));
checkoutRoutes.post("/:checkoutId/retry", wrapAsync(retryCheckoutController));
