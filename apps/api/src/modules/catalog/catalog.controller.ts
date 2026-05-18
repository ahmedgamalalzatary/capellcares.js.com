import type { Request, Response } from "express";
import { inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";
import { listCategoriesRepo } from "../../repositories/category.repository.js";
import { findOfferBySlugRepo, listVisibleOffersRepo } from "../../repositories/offer.repository.js";
import { findVisibleProductBySlug, findVisibleProducts } from "../../repositories/product.repository.js";
import { toStorefrontOffer } from "./offers/offers.mapper.js";

export async function listProducts(req: Request, res: Response) {
  const { q, category } = req.query as { q?: string; category?: string };
  const items = await findVisibleProducts({ lang: "ar", q, category });
  res.json({ items });
}

export async function getProductBySlug(req: Request, res: Response) {
  const product = await findVisibleProductBySlug(req.params.slug);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
}

export async function listCategories(_req: Request, res: Response) {
  const rows = await listCategoriesRepo(false);
  const items = rows.map((category) => ({
    id: category.id,
    parentId: category.parentId,
    slug: category.slug,
    name: {
      ar: category.arName,
      en: category.enName
    },
    isLeaf: category.isLeaf,
    deletedAt: category.deletedAt
  }));
  res.json({ items });
}

export async function listOffers(_req: Request, res: Response) {
  const offers = await listVisibleOffersRepo();
  const items = await Promise.all(
    offers.map(async (offer) => {
      const inventory = await calculateOfferInventory(offer.items);
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
  const inventory = await calculateOfferInventory(offer.items);
  res.json(toStorefrontOffer({ ...offer, stock: inventory.stock }, inventory.originalTotal));
}

async function calculateOfferInventory(items: Array<{ variantId: number; qty: number }>) {
  if (items.length === 0) {
    return { originalTotal: 0, stock: 0 };
  }

  const variantRows = await db
    .select({
      id: productVariants.id,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty
    })
    .from(productVariants)
    .where(inArray(productVariants.id, items.map((item) => item.variantId)));

  const originalTotal = items.reduce((sum, item) => {
    const variant = variantRows.find((row) => row.id === item.variantId);
    return sum + Number(variant?.sellingPrice ?? 0) * item.qty;
  }, 0);

  const stock = items.reduce((minAvailable, item) => {
    const variant = variantRows.find((row) => row.id === item.variantId);
    const availableBundles = Math.floor((variant?.stockQty ?? 0) / item.qty);
    return Math.min(minAvailable, availableBundles);
  }, Number.POSITIVE_INFINITY);

  return {
    originalTotal,
    stock: Number.isFinite(stock) ? stock : 0
  };
}
