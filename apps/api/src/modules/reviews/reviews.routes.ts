import { Router } from "express";

import { wrapAsync } from "../../lib/async-route.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  claimReviewPromptController,
  createReviewController,
  listReviewsController
} from "./reviews.controller.js";

export const storefrontReviewsRoutes = Router();

storefrontReviewsRoutes.post("/", authMiddleware, wrapAsync(createReviewController));
storefrontReviewsRoutes.post("/prompt/claim", authMiddleware, wrapAsync(claimReviewPromptController));
storefrontReviewsRoutes.get("/:entityType/:entityId", wrapAsync(listReviewsController));
