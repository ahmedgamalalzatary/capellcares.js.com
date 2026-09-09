import { Router } from "express";
import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  listAdminAnnouncementsController,
  replaceAdminAnnouncementsController
} from "./admin-announcements.controller.js";

export const adminAnnouncementsRoutes = Router();

adminAnnouncementsRoutes.get("/", requireErpPermission("shop_media.read"), wrapAsync(listAdminAnnouncementsController));
adminAnnouncementsRoutes.post("/", requireErpPermission("shop_media.update"), wrapAsync(replaceAdminAnnouncementsController));
