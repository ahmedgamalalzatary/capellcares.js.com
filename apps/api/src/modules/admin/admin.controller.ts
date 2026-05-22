import type { NextFunction, Request, Response } from "express";
import {
  createAdminProductRepo,
  listAdminProductsRepo,
  replaceVariantsRepo
} from "../../repositories/product.repository.js";
import {
  hasLinkedProductsInCategoryRepo,
  hasActiveChildrenCategoriesRepo,
  listCategoriesRepo,
  restoreCategoryRepo,
  softDeleteCategoryRepo,
  upsertCategoryRepo
} from "../../repositories/category.repository.js";
import {
  listOffersRepo,
  restoreOfferRepo,
  softDeleteOfferRepo,
  upsertOfferRepo
} from "../../repositories/offer.repository.js";
import { toSlug } from "../../services/slug.service.js";
import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";
import { inArray } from "drizzle-orm";
import { toAdminOffer } from "./offers/admin-offers.mapper.js";

// ---- products ----

export async function adminListProducts(_req: Request, res: Response) {
  res.json({ items: await listAdminProductsRepo() });
}

export async function adminUpsertProduct(req: Request, res: Response) {
  const incoming = req.body as any;
  const productNameAr = incoming.name?.ar ?? incoming.arName ?? "";
  const productNameEn = incoming.name?.en ?? incoming.enName ?? "";
  const productVariants = incoming.variants ?? [];
  const productKeywords = Array.isArray(incoming.keywords) ? incoming.keywords : [];
  const productStatus = incoming.status ?? "inactive";
  if (
    productStatus === "active" &&
    (
      !productNameAr ||
      !productNameEn ||
      productKeywords.length === 0 ||
      !incoming.imagePath ||
      !incoming.categoryId ||
      productVariants.length === 0
    )
  ) {
    return res.status(400).json({ ok: false, reason: "cannot-activate-incomplete-product" });
  }
  const created = await createAdminProductRepo({
    id: incoming.id ? Number(incoming.id) : undefined,
    sku: incoming.sku ?? "",
    slug: toSlug(incoming.slug || productNameEn || productNameAr),
    arName: productNameAr,
    enName: productNameEn,
    buyingPrice: Number(incoming.buyingPrice ?? 0),
    keywords: productKeywords.join(","),
    arDescription: incoming.description?.ar ?? incoming.arDescription ?? null,
    enDescription: incoming.description?.en ?? incoming.enDescription ?? null,
    arIngredients: incoming.ingredients?.ar ?? incoming.arIngredients ?? null,
    enIngredients: incoming.ingredients?.en ?? incoming.enIngredients ?? null,
    arHowToUse: incoming.howToUse?.ar ?? incoming.arHowToUse ?? null,
    enHowToUse: incoming.howToUse?.en ?? incoming.enHowToUse ?? null,
    arWarnings: incoming.warnings?.ar ?? incoming.arWarnings ?? null,
    enWarnings: incoming.warnings?.en ?? incoming.enWarnings ?? null,
    youtubeUrl: incoming.youtubeUrl ?? null,
    imagePath: incoming.imagePath ?? null,
    categoryId: Number(incoming.categoryId ?? 0),
    status: productStatus,
    isNew: incoming.isNew ?? false,
    isBestseller: incoming.isBestseller ?? false
  });
  await replaceVariantsRepo(
    created.id,
    productVariants.map((v: any) => ({
      sizeLabel: v.sizeLabel ?? v.size ?? "",
      sellingPrice: Number(v.sellingPrice ?? v.price ?? 0),
      stockQty: Number(v.stockQty ?? v.stock ?? 0)
    }))
  );
  res.json({ ok: true });
}

export async function adminSoftDeleteProduct(req: Request, res: Response) {
  const { softDeleteProductRepo } = await import("../../repositories/product.repository.js");
  await softDeleteProductRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminRestoreProduct(req: Request, res: Response) {
  const { restoreProductRepo } = await import("../../repositories/product.repository.js");
  await restoreProductRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminToggleProductStatus(req: Request, res: Response) {
  const { toggleProductStatusRepo } = await import("../../repositories/product.repository.js");
  await toggleProductStatusRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminSetVariantStock(req: Request, res: Response) {
  const variantId = Number(req.params.variantId);
  const stock = Math.max(0, Number(req.body?.stock ?? 0));
  const { setVariantStockRepo } = await import("../../repositories/product.repository.js");
  await setVariantStockRepo(variantId, stock);
  res.json({ ok: true });
}

// ---- categories ----

export async function adminListCategories(_req: Request, res: Response) {
  res.json({ items: await listCategoriesRepo(true) });
}

export async function adminUpsertCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    await upsertCategoryRepo({
      id: incoming.id,
      parentId: incoming.parentId,
      slug: toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName),
      arName: incoming.name?.ar ?? incoming.arName ?? "",
      enName: incoming.name?.en ?? incoming.enName ?? "",
      isLeaf: Boolean(incoming.isLeaf)
    });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    next(error);
  }
}

export async function adminSoftDeleteCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const hasLinked = await hasLinkedProductsInCategoryRepo(id);
  if (hasLinked) return res.status(409).json({ ok: false, reason: "has-products" });
  const hasActiveChildren = await hasActiveChildrenCategoriesRepo(id);
  if (hasActiveChildren) return res.status(409).json({ ok: false, reason: "has-active-children" });
  await softDeleteCategoryRepo(id);
  res.json({ ok: true });
}

export async function adminRestoreCategory(req: Request, res: Response) {
  await restoreCategoryRepo(Number(req.params.id));
  res.json({ ok: true });
}

// ---- offers ----

export async function adminListOffers(_req: Request, res: Response) {
  const offers = await listOffersRepo(true);
  const items = await Promise.all(
    offers.map(async (offer) => {
      const inventory = await calculateOfferInventory(offer.items);
      return toAdminOffer(offer, inventory.originalTotal, inventory.stock);
    })
  );
  res.json({ items });
}

export async function adminUpsertOffer(req: Request, res: Response) {
  const incoming = req.body as any;
  await upsertOfferRepo({
    id: incoming.id,
    slug: toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName),
    arName: incoming.name?.ar ?? incoming.arName ?? "",
    enName: incoming.name?.en ?? incoming.enName ?? "",
    arDescription: incoming.description?.ar ?? incoming.arDescription ?? null,
    enDescription: incoming.description?.en ?? incoming.enDescription ?? null,
    imagePath: incoming.imagePath ?? null,
    fixedPrice: Number(incoming.price ?? incoming.fixedPrice ?? 0),
    status: incoming.status ?? "inactive",
    visibility: incoming.visibility ?? "visible",
    items: (incoming.items ?? []).map((item: any) => ({ variantId: Number(item.variantId), qty: Number(item.qty) }))
  });
  res.json({ ok: true });
}

export async function adminSoftDeleteOffer(req: Request, res: Response) {
  await softDeleteOfferRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminRestoreOffer(req: Request, res: Response) {
  await restoreOfferRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminToggleOfferStatus(req: Request, res: Response) {
  const { toggleOfferStatusRepo } = await import("../../repositories/offer.repository.js");
  await toggleOfferStatusRepo(Number(req.params.id));
  res.json({ ok: true });
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
