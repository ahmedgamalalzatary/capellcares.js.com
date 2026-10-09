import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { listStorefrontAdvicesController } from "./admin-advices.controller.js";

export const storefrontAdvicesRoutes = Router();
storefrontAdvicesRoutes.get("/", wrapAsync(listStorefrontAdvicesController));
