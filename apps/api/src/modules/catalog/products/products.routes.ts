import { Router } from "express";
import { getProductBySlugController, listProductsController } from "./products.controller.js";

export const catalogProductsRoutes = Router();
catalogProductsRoutes.get("/", listProductsController);
catalogProductsRoutes.get("/:slug", getProductBySlugController);
