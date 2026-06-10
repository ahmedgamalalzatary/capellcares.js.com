import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getCustomerOrderController, listCustomerOrdersController } from "./orders.controller.js";

export const storefrontOrdersRoutes = Router();
storefrontOrdersRoutes.use(authMiddleware);
storefrontOrdersRoutes.get("/", wrapAsync(listCustomerOrdersController));
storefrontOrdersRoutes.get("/:id", wrapAsync(getCustomerOrderController));
