import type { RatingSummary } from "@capella/shared";
import {
  EMPTY_RATING,
  listPublicReviews,
  safeRatingSummaries,
  type ReviewEntityType
} from "../../repositories/review.repository.js";

/**
 * Gives every item in a listing the rating its card draws. Resolved in one
 * grouped read for the whole page, and zeroed for entities nobody has
 * reviewed, so a card never has to tell "unreviewed" from "not loaded".
 */
export async function attachRatings<T extends { id: number }>(
  entityType: ReviewEntityType,
  items: T[]
): Promise<Array<T & { rating: RatingSummary }>> {
  const summaries = await safeRatingSummaries(entityType, items.map((item) => item.id));
  return items.map((item) => ({ ...item, rating: summaries.get(item.id) ?? EMPTY_RATING }));
}

export async function loadReviewData(entityType: ReviewEntityType, entityId: number) {
  try {
    return await listPublicReviews({ entityType, entityId, page: 1, pageSize: 10 });
  } catch (error) {
    console.warn("Failed to load storefront review data", entityType, entityId, error);
    return null;
  }
}

/**
 * The detail payload reports the same rating its card does, reusing the
 * summary already loaded for the review list rather than querying again.
 */
export function ratingFromReviewData(reviewData: Awaited<ReturnType<typeof loadReviewData>>): RatingSummary {
  if (!reviewData) return EMPTY_RATING;
  return { average: reviewData.summary.averageRating, count: reviewData.summary.reviewCount };
}
