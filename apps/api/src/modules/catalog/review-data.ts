import { listPublicReviews, type ReviewEntityType } from "../../repositories/review.repository.js";

export async function loadReviewData(entityType: ReviewEntityType, entityId: number) {
  try {
    return await listPublicReviews({ entityType, entityId, page: 1, pageSize: 10 });
  } catch (error) {
    console.warn("Failed to load storefront review data", entityType, entityId, error);
    return null;
  }
}
