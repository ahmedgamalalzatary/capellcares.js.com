import type { Response } from "express";
import { reviewEntityTypeSchema, reviewStatusSchema, reviewSubmissionSchema } from "@capella/shared";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import type { ErpAuthenticatedRequest } from "../../middlewares/admin-auth.middleware.js";
import {
  createReviewRepo,
  hardDeleteReviewRepo,
  listAdminReviewsRepo,
  listOrderReviewEligibilityRepo,
  listPublicReviewsRepo,
  ReviewAlreadySubmittedError,
  ReviewNotFoundError,
  ReviewPurchaseRequiredError,
  updateReviewStatusRepo
} from "../../repositories/review.repository.js";

function positiveId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function createReviewController(req: AuthenticatedRequest, res: Response) {
  const parsed = reviewSubmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid review" });
  try {
    const review = await createReviewRepo({ customerId: req.user!.id, ...parsed.data });
    return res.status(201).json({ ...review, comment: review.comment ?? null });
  } catch (error) {
    if (error instanceof ReviewPurchaseRequiredError) return res.status(403).json({ message: "Accepted purchase required" });
    if (error instanceof ReviewAlreadySubmittedError) return res.status(409).json({ message: "Review already submitted" });
    throw error;
  }
}

export async function listPublicReviewsController(req: AuthenticatedRequest, res: Response) {
  const entityType = reviewEntityTypeSchema.safeParse(req.params.entityType);
  const entityId = positiveId(req.params.entityId);
  if (!entityType.success || !entityId) return res.status(400).json({ message: "Invalid review target" });
  return res.json(await listPublicReviewsRepo(entityType.data, entityId));
}

export async function listOrderReviewEligibilityController(req: AuthenticatedRequest, res: Response) {
  const orderId = positiveId(req.params.orderId);
  if (!orderId) return res.status(400).json({ message: "Invalid order id" });
  const result = await listOrderReviewEligibilityRepo(req.user!.id, orderId);
  if (!result) return res.status(404).json({ message: "Order not found" });
  return res.json(result);
}

export async function listAdminReviewsController(_req: ErpAuthenticatedRequest, res: Response) {
  return res.json({ items: await listAdminReviewsRepo() });
}

export async function updateReviewStatusController(req: ErpAuthenticatedRequest, res: Response) {
  const id = positiveId(req.params.id);
  const status = reviewStatusSchema.safeParse(req.body?.status);
  if (!id || !status.success || status.data === "pending") return res.status(400).json({ message: "Invalid review status" });
  try {
    return res.json(await updateReviewStatusRepo(id, status.data, req.adminUser!.id));
  } catch (error) {
    if (error instanceof ReviewNotFoundError) return res.status(404).json({ message: "Review not found" });
    throw error;
  }
}

export async function hardDeleteReviewController(req: ErpAuthenticatedRequest, res: Response) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid review id" });
  try {
    await hardDeleteReviewRepo(id);
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof ReviewNotFoundError) return res.status(404).json({ message: "Review not found" });
    throw error;
  }
}
