import { findVisibleProducts } from "../../../repositories/product.repository.js";
import {
  searchVisibleCategoriesRepo,
  searchVisibleCollectionsRepo,
  searchVisibleOffersRepo
} from "../../../repositories/storefront-search.repository.js";
import { calculateBundleInventory } from "../../inventory/bundle-inventory.js";
import { toStorefrontCollection } from "../collections/collections.mapper.js";
import { toStorefrontOffer } from "../offers/offers.mapper.js";
import { toStorefrontProduct } from "../products/products.mapper.js";

export async function searchStorefront(query: string) {
  const [productRows, categoryRows, offerRows, collectionRows] = await Promise.all([
    findVisibleProducts({ lang: "en", q: query, limit: 5 }),
    searchVisibleCategoriesRepo(query),
    searchVisibleOffersRepo(query),
    searchVisibleCollectionsRepo(query)
  ]);
  const [offers, collections] = await Promise.all([
    Promise.all(offerRows.map(async (offer) => {
      const inventory = await calculateBundleInventory(offer.items);
      return toStorefrontOffer({ ...offer, stock: inventory.stock }, inventory.originalTotal);
    })),
    Promise.all(collectionRows.map(async (collection) => {
      const inventory = await calculateBundleInventory(collection.items);
      return toStorefrontCollection({ ...collection, stock: inventory.stock }, inventory.originalTotal);
    }))
  ]);

  return {
    products: productRows.map(toStorefrontProduct),
    categories: categoryRows.map((category) => ({
      id: category.id,
      parentId: category.parentId,
      slug: category.slug,
      sortOrder: category.sortOrder,
      name: { ar: category.arName, en: category.enName },
      imagePath: category.imagePath,
      isLeaf: category.isLeaf,
      deletedAt: category.deletedAt
    })),
    offers,
    collections
  };
}
