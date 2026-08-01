import { findCollectionBySlugRepo, listVisibleCollectionsRepo } from "../../../repositories/collection.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../../repositories/related-item.repository.js";
import { calculateBundleInventory } from "../../inventory/bundle-inventory.js";
import { loadReviewData } from "../review-data.js";
import { toStorefrontCollection } from "./collections.mapper.js";

export async function listStorefrontCollections() {
  const collections = await listVisibleCollectionsRepo();
  return Promise.all(
    collections.map(async (collection) => {
      const inventory = await calculateBundleInventory(collection.items);
      return toStorefrontCollection({ ...collection, stock: inventory.stock }, inventory.originalTotal);
    })
  );
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
    relatedItems,
    reviewData
  };
}
