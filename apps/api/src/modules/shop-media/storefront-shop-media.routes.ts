import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import {
  listStorefrontShopCustomSectionsController,
  listStorefrontShopMediaSectionsController
} from "./storefront-shop-media.controller.js";

export const storefrontShopMediaRoutes = Router();

storefrontShopMediaRoutes.get("/", wrapAsync(listStorefrontShopMediaSectionsController));

export const storefrontShopCustomSectionsRoutes = Router();

storefrontShopCustomSectionsRoutes.get("/", wrapAsync(listStorefrontShopCustomSectionsController));
