import { findCollectionBySlugRepo, listVisibleCollectionsRepo } from "../../../repositories/collection.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../../repositories/related-item.repository.js";
import {
  calculateBundleInventory,
  computeBundleInventoryFromMap,
  loadBundleVariantMap
} from "../../inventory/bundle-inventory.js";
import { attachRatings, loadReviewData, ratingFromReviewData } from "../review-data.js";
import { toStorefrontCollection } from "./collections.mapper.js";
import type { Language } from "@capella/shared";

export async function listStorefrontCollections(lang: Language = "ar") {
  const collections = await listVisibleCollectionsRepo(lang);
  const variantMap = await loadBundleVariantMap(collections);
  const items = collections.map((collection) => {
    const inventory = computeBundleInventoryFromMap(collection.items, variantMap);
    return toStorefrontCollection({ ...collection, stock: inventory.stock }, inventory.originalTotal);
  });
  return attachRatings("collection", items);
}

export async function getStorefrontCollectionBySlug(slug: string, lang: Language = "ar") {
  const collection = await findCollectionBySlugRepo(slug, lang);
  if (!collection) {
    return null;
  }
  const [inventory, relatedItems, reviewData] = await Promise.all([
    calculateBundleInventory(collection.items),
    getStorefrontRelatedCardsRepo({ type: "collection", id: collection.id }, lang),
    loadReviewData("collection", collection.id)
  ]);
  return {
    ...toStorefrontCollection({ ...collection, stock: inventory.stock }, inventory.originalTotal),
    rating: ratingFromReviewData(reviewData),
    relatedItems,
    reviewData
  };
}
