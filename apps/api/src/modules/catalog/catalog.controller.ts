import type { Request, Response } from "express";
import { listCategoriesRepo } from "../../repositories/category.repository.js";
import { findOfferBySlugRepo, listVisibleOffersRepo } from "../../repositories/offer.repository.js";
import { getStorefrontRelatedCardsRepo } from "../../repositories/related-item.repository.js";
import { calculateBundleInventory } from "../inventory/bundle-inventory.js";
import { toStorefrontOffer } from "./offers/offers.mapper.js";

export async function listCategories(_req: Request, res: Response) {
  const rows = await listCategoriesRepo(false, "storefront");
  const items = rows.map((category) => ({
    id: category.id,
    parentId: category.parentId,
    slug: category.slug,
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

export async function listOffers(_req: Request, res: Response) {
  const offers = await listVisibleOffersRepo();
  const items = await Promise.all(
    offers.map(async (offer) => {
      const inventory = await calculateBundleInventory(offer.items);
      return toStorefrontOffer(
        { ...offer, stock: inventory.stock },
        inventory.originalTotal
      );
    })
  );
  res.json({ items });
}

export async function getOfferBySlug(req: Request, res: Response) {
  const offer = await findOfferBySlugRepo(req.params.slug);
  if (!offer) return res.status(404).json({ message: "Offer not found" });
  const inventory = await calculateBundleInventory(offer.items);
  const relatedItems = await getStorefrontRelatedCardsRepo({ type: "offer", id: offer.id });
  res.json({ ...toStorefrontOffer({ ...offer, stock: inventory.stock }, inventory.originalTotal), relatedItems });
}
