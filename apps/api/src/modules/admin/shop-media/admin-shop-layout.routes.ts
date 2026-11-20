import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import { listAdminShopLayoutController, replaceAdminShopLayoutController } from "./admin-shop-layout.controller.js";

export const adminShopLayoutRoutes = Router();

adminShopLayoutRoutes.get("/", requireErpPermission("shop_media.read"), wrapAsync(listAdminShopLayoutController));
adminShopLayoutRoutes.put("/", requireErpPermission("shop_media.update"), wrapAsync(replaceAdminShopLayoutController));
