import { Router } from "express";
import { wrapAsync } from "../../lib/async-route.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  createReviewController,
  listOrderReviewEligibilityController,
  listPublicReviewsController
} from "./reviews.controller.js";

export const storefrontReviewsRoutes = Router();
storefrontReviewsRoutes.post("/", authMiddleware, wrapAsync(createReviewController));
storefrontReviewsRoutes.get("/eligibility/:orderId", authMiddleware, wrapAsync(listOrderReviewEligibilityController));
storefrontReviewsRoutes.get("/:entityType/:entityId", wrapAsync(listPublicReviewsController));
