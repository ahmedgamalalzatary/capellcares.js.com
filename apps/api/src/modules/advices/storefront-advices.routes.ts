import { Router } from "express";
import { listStorefrontAdvicesController } from "./advices.controller.js";

export const storefrontAdvicesRoutes = Router();
storefrontAdvicesRoutes.get("/", listStorefrontAdvicesController);
