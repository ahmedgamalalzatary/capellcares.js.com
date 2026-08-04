import { findCollectionBySlugRepo, listVisibleCollectionsRepo } from "../../../repositories/collection.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../../repositories/related-item.repository.js";
import {
  calculateBundleInventory,
  computeBundleInventoryFromMap,
  loadBundleVariantMap
} from "../../inventory/bundle-inventory.js";
import { attachRatings, loadReviewData, ratingFromReviewData } from "../review-data.js";
import { toStorefrontCollection } from "./collections.mapper.js";

export async function listStorefrontCollections() {
  const collections = await listVisibleCollectionsRepo();
  const variantMap = await loadBundleVariantMap(collections);
  const items = collections.map((collection) => {
    const inventory = computeBundleInventoryFromMap(collection.items, variantMap);
    return toStorefrontCollection({ ...collection, stock: inventory.stock }, inventory.originalTotal);
  });
  return attachRatings("collection", items);
}

export async function getStorefrontCollectionBySlug(slug: string) {
  const collection = await findCollectionBySlugRepo(slug);
  if (!collection) {
    return null;
  }
  const [inventory, relatedItems, reviewData] = await Promise.all([
    calculateBundleInventory(collection.items),
    getStorefrontRelatedCardsRepo({ type: "collection", id: collection.id }),
    loadReviewData("collection", collection.id)
  ]);
  return {
    ...toStorefrontCollection({ ...collection, stock: inventory.stock }, inventory.originalTotal),
    rating: ratingFromReviewData(reviewData),
    relatedItems,
    reviewData
  };
}
