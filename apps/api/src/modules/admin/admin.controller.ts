import type { Request, Response } from "express";
import type { Category, Offer, Product } from "@capella/shared";
import {
  addVariantRepo,
  createAdminProductRepo,
  listAdminProductsRepo
} from "../../repositories/product.repository.js";
import {
  hasLinkedProductsInCategoryRepo,
  listCategoriesRepo,
  restoreCategoryRepo,
  softDeleteCategoryRepo,
  upsertCategoryRepo
} from "../../repositories/category.repository.js";
import {
  findOfferBySlugRepo,
  listOffersRepo,
  restoreOfferRepo,
  softDeleteOfferRepo,
  upsertOfferRepo
} from "../../repositories/offer.repository.js";

// ---- products ----

export async function adminListProducts(_req: Request, res: Response) {
  res.json({ items: await listAdminProductsRepo() });
}

export async function adminUpsertProduct(req: Request, res: Response) {
  const incoming = req.body as Product;
  const created = await createAdminProductRepo({
    sku: incoming.sku,
    slug: incoming.slug,
    arName: incoming.name.ar,
    enName: incoming.name.en,
    buyingPrice: incoming.buyingPrice,
    keywords: incoming.keywords.join(","),
    imagePath: incoming.imagePath ?? null,
    categoryId: incoming.categoryId,
    status: incoming.status,
    isNew: (incoming as any).isNew ?? false,
    isBestseller: (incoming as any).isBestseller ?? false
  });
  for (const v of incoming.variants ?? []) {
    await addVariantRepo({
      productId: created.id,
      sizeLabel: v.size,
      sellingPrice: v.price,
      stockQty: v.stock
    });
  }
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

export async function adminUpsertCategory(req: Request, res: Response) {
  const incoming = req.body as Category;
  await upsertCategoryRepo({
    id: incoming.id,
    parentId: incoming.parentId,
    slug: incoming.slug,
    arName: incoming.name.ar,
    enName: incoming.name.en,
    isLeaf: incoming.isLeaf
  });
  res.json({ ok: true });
}

export async function adminSoftDeleteCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  const hasLinked = await hasLinkedProductsInCategoryRepo(id);
  if (hasLinked) return res.status(409).json({ ok: false, reason: "has-products" });
  await softDeleteCategoryRepo(id);
  res.json({ ok: true });
}

export async function adminRestoreCategory(req: Request, res: Response) {
  await restoreCategoryRepo(Number(req.params.id));
  res.json({ ok: true });
}

// ---- offers ----

export async function adminListOffers(_req: Request, res: Response) {
  res.json({ items: await listOffersRepo(true) });
}

export async function adminUpsertOffer(req: Request, res: Response) {
  const incoming = req.body as Offer;
  await upsertOfferRepo({
    id: incoming.id,
    slug: incoming.slug,
    arName: incoming.name.ar,
    enName: incoming.name.en,
    arDescription: incoming.description?.ar ?? null,
    enDescription: incoming.description?.en ?? null,
    imagePath: incoming.imagePath ?? null,
    fixedPrice: incoming.price,
    status: incoming.status,
    items: incoming.items.map((item) => ({ variantId: item.variantId, qty: item.qty }))
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
