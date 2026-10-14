import type { Request, Response } from "express";
import { z } from "zod";

import {
  listAdminReviews,
  findReviewTargetByReviewId,
  permanentlyDeleteReview,
  restoreReview,
  softDeleteReview,
  toggleReviewStatus
} from "../../reviews/review.repository.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";
import { pagedQuerySchema } from "../../../lib/pagination.js";

const listQuerySchema = pagedQuerySchema([], {
  deleted: z.literal("true").optional(),
  status: z.enum(["active", "inactive"]).optional(),
  entityType: z.enum(["product", "offer", "collection"]).optional()
});

async function captureReviewTarget(id: number) {
  return findReviewTargetByReviewId(id);
}

async function revalidateReviewTarget(target: Awaited<ReturnType<typeof captureReviewTarget>>) {
  if (!target) return;
  try {
    await triggerStorefrontRevalidation({ entity: target.entityType, slug: target.slug });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for review", target, error);
  }
}

function positiveInteger(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function listAdminReviewsController(req: Request, res: Response) {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Invalid review list query" });
  const { page, pageSize, pages, q, deleted, status, entityType } = query.data;
  return res.json(await listAdminReviews({ page, pageSize, pages, deleted: deleted === "true", status, entityType, q }));
}

export async function toggleAdminReviewStatusController(req: Request, res: Response) {
  const id = positiveInteger(req.params.id, 0);
  if (!id) return res.status(400).json({ message: "Invalid review id" });
  const target = await captureReviewTarget(id);
  const result = await toggleReviewStatus(id);
  if (!result) return res.status(404).json({ message: "Review not found" });
  await revalidateReviewTarget(target);
  return res.json(result);
}

export async function softDeleteAdminReviewController(req: Request, res: Response) {
  const id = positiveInteger(req.params.id, 0);
  if (!id) return res.status(400).json({ message: "Invalid review id" });
  const target = await captureReviewTarget(id);
  if (!(await softDeleteReview(id))) return res.status(404).json({ message: "Review not found" });
  await revalidateReviewTarget(target);
  return res.json({ ok: true });
}

export async function restoreAdminReviewController(req: Request, res: Response) {
  const id = positiveInteger(req.params.id, 0);
  if (!id) return res.status(400).json({ message: "Invalid review id" });
  const target = await captureReviewTarget(id);
  if (!(await restoreReview(id))) return res.status(404).json({ message: "Review not found" });
  await revalidateReviewTarget(target);
  return res.json({ ok: true });
}

export async function permanentlyDeleteAdminReviewController(req: Request, res: Response) {
  const id = positiveInteger(req.params.id, 0);
  if (!id) return res.status(400).json({ message: "Invalid review id" });
  const target = await captureReviewTarget(id);
  if (!(await permanentlyDeleteReview(id))) return res.status(404).json({ message: "Review not found in trash" });
  await revalidateReviewTarget(target);
  return res.json({ ok: true });
}
