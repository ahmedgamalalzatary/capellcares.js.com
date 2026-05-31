import { Router } from "express";
import { localeMiddleware } from "../middlewares/locale.middleware.js";
import { checkoutRoutes } from "../modules/checkout/checkout.routes.js";
import { catalogCollectionsRoutes } from "../modules/catalog/collections/collections.routes.js";
import { catalogProductsRoutes } from "../modules/catalog/products/products.routes.js";
import { getOfferBySlug, listCategories, listOffers } from "../modules/catalog/catalog.controller.js";
import { storefrontAdvicesRoutes } from "../modules/advices/storefront-advices.routes.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { storefrontOrdersRoutes } from "../modules/orders/orders.routes.js";
import { wishlistRoutes } from "../modules/wishlist/wishlist.routes.js";

export const storefrontRoutes = Router();
storefrontRoutes.use(localeMiddleware);

storefrontRoutes.use("/products", catalogProductsRoutes);
storefrontRoutes.use("/collections", catalogCollectionsRoutes);
storefrontRoutes.use("/checkout", checkoutRoutes);
storefrontRoutes.use("/advices", storefrontAdvicesRoutes);
storefrontRoutes.use("/auth", authRoutes);
storefrontRoutes.use("/orders", storefrontOrdersRoutes);
storefrontRoutes.use("/wishlist", wishlistRoutes);
storefrontRoutes.get("/categories", listCategories);
storefrontRoutes.get("/offers", listOffers);
storefrontRoutes.get("/offers/:slug", getOfferBySlug);
