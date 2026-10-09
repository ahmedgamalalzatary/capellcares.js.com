import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  listAdminShopMediaSectionsController,
  updateAdminShopMediaSectionController
} from "./admin-shop-media.controller.js";

export const adminShopMediaRoutes = Router();

adminShopMediaRoutes.get("/", requireErpPermission("shop_media.read"), wrapAsync(listAdminShopMediaSectionsController));
adminShopMediaRoutes.post("/:slot", requireErpPermission("shop_media.update"), wrapAsync(updateAdminShopMediaSectionController));
