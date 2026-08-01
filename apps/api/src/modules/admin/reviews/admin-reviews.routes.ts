import { Router } from "express";

import { wrapAsync } from "../../../lib/async-route.js";
import { requireErpPermission } from "../../../middlewares/erp-permissions.middleware.js";
import {
  listAdminReviewsController,
  permanentlyDeleteAdminReviewController,
  restoreAdminReviewController,
  softDeleteAdminReviewController,
  toggleAdminReviewStatusController
} from "./admin-reviews.controller.js";

export const adminReviewsRoutes = Router();

adminReviewsRoutes.get(
  "/",
  requireErpPermission("reviews.read"),
  requireErpPermission((req) => req.query.deleted === "true" ? "trash.read" : "reviews.read"),
  wrapAsync(listAdminReviewsController)
);
adminReviewsRoutes.post("/:id/toggle-status", requireErpPermission("reviews.toggle_status"), wrapAsync(toggleAdminReviewStatusController));
adminReviewsRoutes.delete("/:id", requireErpPermission("reviews.soft_delete"), wrapAsync(softDeleteAdminReviewController));
adminReviewsRoutes.post("/:id/restore", requireErpPermission("reviews.restore"), wrapAsync(restoreAdminReviewController));
adminReviewsRoutes.delete("/:id/permanent", requireErpPermission("reviews.permanent_delete"), wrapAsync(permanentlyDeleteAdminReviewController));
