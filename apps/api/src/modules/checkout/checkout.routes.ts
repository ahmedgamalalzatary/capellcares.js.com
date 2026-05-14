import { Router } from "express";
import { checkoutController } from "./checkout.controller.js";

export const checkoutRoutes = Router();
checkoutRoutes.post("/", checkoutController);
