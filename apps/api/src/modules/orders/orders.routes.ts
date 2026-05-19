import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getCustomerOrderController, listCustomerOrdersController } from "./orders.controller.js";

export const storefrontOrdersRoutes = Router();
storefrontOrdersRoutes.use(authMiddleware);
storefrontOrdersRoutes.get("/", listCustomerOrdersController);
storefrontOrdersRoutes.get("/:id", getCustomerOrderController);
