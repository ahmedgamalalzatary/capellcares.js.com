import { Router } from "express";
import { localeMiddleware } from "../middlewares/locale.middleware.js";
import { checkoutRoutes } from "../modules/checkout/checkout.routes.js";
import { catalogProductsRoutes } from "../modules/catalog/products/products.routes.js";
import { getOfferBySlug, listCategories, listOffers } from "../modules/catalog/catalog.controller.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { wishlistRoutes } from "../modules/wishlist/wishlist.routes.js";

export const storefrontRoutes = Router();
storefrontRoutes.use(localeMiddleware);

storefrontRoutes.use("/products", catalogProductsRoutes);
storefrontRoutes.use("/checkout", checkoutRoutes);
storefrontRoutes.use("/auth", authRoutes);
storefrontRoutes.use("/wishlist", wishlistRoutes);
storefrontRoutes.get("/categories", listCategories);
storefrontRoutes.get("/offers", listOffers);
storefrontRoutes.get("/offers/:slug", getOfferBySlug);
