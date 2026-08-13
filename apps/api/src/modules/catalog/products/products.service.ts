import { findVisibleProductBySlug, findVisibleProducts } from "../../../repositories/product.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../../repositories/related-item.repository.js";
import type { Language } from "../../../types/domain.js";
import { attachRatings, loadReviewData, ratingFromReviewData } from "../review-data.js";
import { toStorefrontProduct } from "./products.mapper.js";

export async function listStorefrontProducts(args: { lang: Language; q?: string; category?: string; categoryId?: string }) {
  const products = await findVisibleProducts(args);
  return attachRatings("product", products.map(toStorefrontProduct));
}

export async function getStorefrontProductBySlug(slug: string, lang: Language = "ar") {
  const product = await findVisibleProductBySlug(slug, lang);
  if (!product) {
    return null;
  }
  const [relatedItems, reviewData] = await Promise.all([
    getStorefrontRelatedCardsRepo({ type: "product", id: product.id }, lang),
    loadReviewData("product", product.id)
  ]);
  return { ...toStorefrontProduct(product), rating: ratingFromReviewData(reviewData), relatedItems, reviewData };
}
