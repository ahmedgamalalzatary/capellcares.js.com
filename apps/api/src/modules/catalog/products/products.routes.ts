import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { getProductBySlugController, listProductsController } from "./products.controller.js";

export const catalogProductsRoutes = Router();
catalogProductsRoutes.get("/", wrapAsync(listProductsController));
catalogProductsRoutes.get("/:slug", wrapAsync(getProductBySlugController));
