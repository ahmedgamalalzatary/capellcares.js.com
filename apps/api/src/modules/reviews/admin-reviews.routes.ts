import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { requireErpPermission } from "../../middlewares/erp-permissions.middleware.js";
import {
  hardDeleteReviewController,
  listAdminReviewsController,
  updateReviewStatusController
} from "./reviews.controller.js";

export const adminReviewsRoutes = Router();
adminReviewsRoutes.get("/", requireErpPermission("reviews.read"), wrapAsync(listAdminReviewsController));
adminReviewsRoutes.patch("/:id/status", requireErpPermission("reviews.moderate"), wrapAsync(updateReviewStatusController));
adminReviewsRoutes.delete("/:id", requireErpPermission("reviews.delete"), wrapAsync(hardDeleteReviewController));
