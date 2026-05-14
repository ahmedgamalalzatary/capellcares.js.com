import { Router } from "express";
import { localeMiddleware } from "../middlewares/locale.middleware.js";
import { checkoutRoutes } from "../modules/checkout/checkout.routes.js";
import { catalogProductsRoutes } from "../modules/catalog/products/products.routes.js";

export const storefrontRoutes = Router();
storefrontRoutes.use(localeMiddleware);

storefrontRoutes.use("/products", catalogProductsRoutes);
storefrontRoutes.use("/checkout", checkoutRoutes);

storefrontRoutes.get("/offers", (_req, res) => {
  res.json({ items: [] });
});
