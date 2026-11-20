import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  listAdminShopCustomSectionsController,
  replaceAdminShopCustomSectionsController
} from "./admin-shop-custom-sections.controller.js";

export const adminShopCustomSectionsRoutes = Router();

adminShopCustomSectionsRoutes.get("/", requireErpPermission("shop_media.read"), wrapAsync(listAdminShopCustomSectionsController));
adminShopCustomSectionsRoutes.put("/", requireErpPermission("shop_media.update"), wrapAsync(replaceAdminShopCustomSectionsController));
