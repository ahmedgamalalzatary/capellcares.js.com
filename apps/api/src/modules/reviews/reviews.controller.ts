import type { Response } from "express";
import { reviewCreateSchema } from "@capella/shared";

import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import {
  createVerifiedReview,
  findReviewTargetSlug,
  claimReviewPrompt,
  listPublicReviews,
  ReviewAlreadyExistsError,
  ReviewEligibilityError,
  type ReviewEntityType
} from "../../repositories/review.repository.js";
import { triggerStorefrontRevalidation } from "../admin/storefront-revalidation.js";

async function revalidateReviewTarget(entityType: ReviewEntityType, entityId: number) {
  try {
    const slug = await findReviewTargetSlug(entityType, entityId);
    if (!slug) return;
    await triggerStorefrontRevalidation({ entity: entityType, slug });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for review target", entityType, entityId, error);
  }
}

function isReviewEntityType(value: unknown): value is ReviewEntityType {
  return value === "product" || value === "offer" || value === "collection";
}

function parsePositiveInteger(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function listReviewsController(req: AuthenticatedRequest, res: Response) {
  const entityType = req.params.entityType;
  const entityId = parsePositiveInteger(req.params.entityId, 0);
  const page = parsePositiveInteger(req.query.page, 1);
  const requestedPageSize = parsePositiveInteger(req.query.pageSize, 10);
  if (!isReviewEntityType(entityType) || !entityId || !page || !requestedPageSize) {
    return res.status(400).json({ message: "Invalid review query" });
  }
  const pageSize = Math.min(requestedPageSize, 50);
  return res.json(await listPublicReviews({ entityType, entityId, page, pageSize }));
}

export async function claimReviewPromptController(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  const prompt = await claimReviewPrompt(req.user.id);
  if (!prompt) return res.status(204).send();
  return res.json(prompt);
}

export async function createReviewController(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const parsed = reviewCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid review" });
  }
  const { entityType, entityId, rating, comment } = parsed.data;

  try {
    const review = await createVerifiedReview({
      customerId: req.user.id,
      entityType,
      entityId,
      rating,
      comment
    });
    await revalidateReviewTarget(entityType, entityId);
    return res.status(201).json(review);
  } catch (error) {
    if (error instanceof ReviewAlreadyExistsError) {
      return res.status(409).json({ message: error.message });
    }
    if (error instanceof ReviewEligibilityError) {
      return res.status(403).json({ message: error.message });
    }
    throw error;
  }
}
