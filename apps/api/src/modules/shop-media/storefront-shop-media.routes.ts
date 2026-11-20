import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { listStorefrontShopLayoutController, listStorefrontShopMediaSectionsController } from "./storefront-shop-media.controller.js";

export const storefrontShopMediaRoutes = Router();

storefrontShopMediaRoutes.get("/", wrapAsync(listStorefrontShopMediaSectionsController));

export const storefrontShopLayoutRoutes = Router();

storefrontShopLayoutRoutes.get("/", wrapAsync(listStorefrontShopLayoutController));
