import { Router } from "express";
import {
  createAdminProductController,
  listAdminProductsController
} from "./admin-products.controller.js";

export const adminProductsRoutes = Router();
adminProductsRoutes.get("/", listAdminProductsController);
adminProductsRoutes.post("/", createAdminProductController);
