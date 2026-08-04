import { Router } from "express";
import { wrapAsync } from "../lib/async-route.js";
import { localeMiddleware } from "../middlewares/locale.middleware.js";
import { checkoutRoutes } from "../modules/checkout/checkout.routes.js";
import { catalogCollectionsRoutes } from "../modules/catalog/collections/collections.routes.js";
import { catalogProductsRoutes } from "../modules/catalog/products/products.routes.js";
import { getOfferBySlug, listCategories, listOffers } from "../modules/catalog/catalog.controller.js";
import { storefrontAdvicesRoutes } from "../modules/admin/advices/storefront-advices.routes.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { storefrontOrdersRoutes } from "../modules/orders/orders.routes.js";
import { storefrontShopMediaRoutes } from "../modules/shop-media/storefront-shop-media.routes.js";
import { wishlistRoutes } from "../modules/wishlist/wishlist.routes.js";
import { storefrontReviewsRoutes } from "../modules/reviews/reviews.routes.js";

export const storefrontRoutes = Router();
storefrontRoutes.use(localeMiddleware);

storefrontRoutes.use("/products", catalogProductsRoutes);
storefrontRoutes.use("/collections", catalogCollectionsRoutes);
storefrontRoutes.use("/checkout", checkoutRoutes);
storefrontRoutes.use("/advices", storefrontAdvicesRoutes);
storefrontRoutes.use("/auth", authRoutes);
storefrontRoutes.use("/orders", storefrontOrdersRoutes);
storefrontRoutes.use("/wishlist", wishlistRoutes);
storefrontRoutes.use("/reviews", storefrontReviewsRoutes);
storefrontRoutes.use("/shop-media-sections", storefrontShopMediaRoutes);
// Wrapped like the product and collection routers: an unwrapped async handler
// rejects into an unhandled rejection, which takes the process down rather than
// returning a 500.
storefrontRoutes.get("/categories", wrapAsync(listCategories));
storefrontRoutes.get("/offers", wrapAsync(listOffers));
storefrontRoutes.get("/offers/:slug", wrapAsync(getOfferBySlug));
