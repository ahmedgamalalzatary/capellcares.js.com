import { Router } from "express";
import { listStorefrontShopMediaSectionsController } from "./storefront-shop-media.controller.js";

export const storefrontShopMediaRoutes = Router();

storefrontShopMediaRoutes.get("/", listStorefrontShopMediaSectionsController);
