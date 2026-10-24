import type { Request, Response } from "express";
import { listCategoriesRepo, listVisibleProductCategoryIdsRepo } from "./categories/category.repository.js";
import { collectCategoryIdsWithProducts } from "./categories/category-tree.js";
import { findOfferBySlugRepo, listVisibleOffersRepo } from "./offers/offer.repository.js";
import { getStorefrontRelatedCardsRepo } from "../shared/related-items/related-item.repository.js";
import {
  calculateBundleInventory,
  computeBundleInventoryFromMap,
  loadBundleVariantMap
} from "../inventory/bundle-inventory.js";
import { toStorefrontOffer } from "./offers/offers.mapper.js";
import { attachRatings, loadReviewData, ratingFromReviewData } from "./review-data.js";
import type { LocalizedRequest } from "../../middlewares/locale.middleware.js";

export async function listCategories(_req: Request, res: Response) {
  // Categories mirror the ERP tree (oldest unranked first); the storefront client re-sorts, but keep the API response consistent with that ordering.
  const [rows, productCategoryIds] = await Promise.all([listCategoriesRepo(false, "erp"), listVisibleProductCategoryIdsRepo()]);
  // An empty category (no visible product in it or beneath it) stays in the list so names still resolve; the storefront keeps it out of menus and shows "coming soon" on its page.
  const withProducts = collectCategoryIdsWithProducts(productCategoryIds, rows);
  const items = rows.map((category) => ({
    id: category.id,
    parentId: category.parentId,
    slug: category.slug,
    imagePath: category.imagePath ?? null,
    sortOrder: category.sortOrder ?? 0,
    name: {
      ar: category.arName,
      en: category.enName
    },
    isLeaf: category.isLeaf,
    hasProducts: withProducts.has(category.id),
    createdAt: category.createdAt,
    deletedAt: category.deletedAt
  }));
  res.json({ items });
}

export async function listOffers(req: Request, res: Response) {
  const lang = (req as LocalizedRequest).locale ?? "ar";
  const offers = await listVisibleOffersRepo(lang);
  const variantMap = await loadBundleVariantMap(offers);
  const items = offers.map((offer) => {
    const inventory = computeBundleInventoryFromMap(offer.items, variantMap);
    return toStorefrontOffer(
      { ...offer, stock: inventory.stock },
      inventory.originalTotal
    );
  });
  res.json({ items: await attachRatings("offer", items) });
}

export async function getOfferBySlug(req: Request, res: Response) {
  const lang = (req as LocalizedRequest).locale ?? "ar";
  const offer = await findOfferBySlugRepo(req.params.slug, lang);
  if (!offer) return res.status(404).json({ message: "Offer not found" });
  const [inventory, relatedItems, reviewData] = await Promise.all([
    calculateBundleInventory(offer.items),
    getStorefrontRelatedCardsRepo({ type: "offer", id: offer.id }, lang),
    loadReviewData("offer", offer.id)
  ]);
  res.json({
    ...toStorefrontOffer({ ...offer, stock: inventory.stock }, inventory.originalTotal),
    rating: ratingFromReviewData(reviewData),
    relatedItems,
    reviewData
  });
}
