import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { listStorefrontShopMediaSectionsController } from "./storefront-shop-media.controller.js";

export const storefrontShopMediaRoutes = Router();

storefrontShopMediaRoutes.get("/", wrapAsync(listStorefrontShopMediaSectionsController));
