import { Router } from "express";
import {
  listProducts,
  getProductBySlug,
  listCategories,
  listOffers,
  getOfferBySlug
} from "./catalog.controller.js";

export const catalogRoutes = Router();
catalogRoutes.get("/products", listProducts);
catalogRoutes.get("/products/:slug", getProductBySlug);
catalogRoutes.get("/categories", listCategories);
catalogRoutes.get("/offers", listOffers);
catalogRoutes.get("/offers/:slug", getOfferBySlug);
