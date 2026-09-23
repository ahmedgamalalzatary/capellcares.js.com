import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { cartReplacePayloadSchema } from "@capella/shared/schemas";
import { getCartController, saveCartController } from "./cart.controller.js";

export const cartRoutes = Router();
cartRoutes.use(authMiddleware);
cartRoutes.get("/", getCartController);
cartRoutes.put("/", validateBody((input) => cartReplacePayloadSchema.parse(input)), saveCartController);
