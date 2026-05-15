import { Router } from "express";
import { localeMiddleware } from "../middlewares/locale.middleware.js";
import { checkoutRoutes } from "../modules/checkout/checkout.routes.js";
import { catalogProductsRoutes } from "../modules/catalog/products/products.routes.js";
import { getOfferBySlug, listCategories, listOffers } from "../modules/catalog/catalog.controller.js";

export const storefrontRoutes = Router();
storefrontRoutes.use(localeMiddleware);

storefrontRoutes.use("/products", catalogProductsRoutes);
storefrontRoutes.use("/checkout", checkoutRoutes);
storefrontRoutes.get("/categories", listCategories);
storefrontRoutes.get("/offers", listOffers);
storefrontRoutes.get("/offers/:slug", getOfferBySlug);
