import { Router } from "express";
import { listStorefrontAdvicesController } from "./admin-advices.controller.js";

export const storefrontAdvicesRoutes = Router();
storefrontAdvicesRoutes.get("/", listStorefrontAdvicesController);
