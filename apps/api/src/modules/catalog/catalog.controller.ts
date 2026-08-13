import type { Request, Response } from "express";
import { listCategoriesRepo } from "../../repositories/category.repository.js";
import { findOfferBySlugRepo, listVisibleOffersRepo } from "../../repositories/offer.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../repositories/related-item.repository.js";
import {
  calculateBundleInventory,
  computeBundleInventoryFromMap,
  loadBundleVariantMap
} from "../inventory/bundle-inventory.js";
import { toStorefrontOffer } from "./offers/offers.mapper.js";
import { attachRatings, loadReviewData, ratingFromReviewData } from "./review-data.js";
import type { LocalizedRequest } from "../../middlewares/locale.middleware.js";

export async function listCategories(_req: Request, res: Response) {
  // Categories mirror the ERP tree (oldest unranked first); the storefront
  // client re-sorts, but keep the API response consistent with that ordering.
  const rows = await listCategoriesRepo(false, "erp");
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
