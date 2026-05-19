import { Router } from "express";
import { checkoutController } from "./checkout.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { parseCheckoutBody } from "./checkout.schemas.js";
import { optionalAuthMiddleware } from "../../middlewares/auth.middleware.js";

export const checkoutRoutes = Router();
checkoutRoutes.post("/", optionalAuthMiddleware, validateBody(parseCheckoutBody), checkoutController);
