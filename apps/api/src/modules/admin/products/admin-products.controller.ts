import type { NextFunction, Request, Response } from "express";
import { db } from "@capella/database/src/db";
import {
  createAdminProductRepo,
  listAdminProductsRepo,
  replaceVariantsRepo
} from "../../../repositories/product.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo,
  type RelatedEntityType,
  type RelatedRef
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { triggerStorefrontProductRevalidation } from "../storefront-revalidation.js";

const RELATED_ENTITY_TYPES: RelatedEntityType[] = ["product", "offer", "collection"];

function parseRelatedItems(value: unknown): RelatedRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const refs: RelatedRef[] = [];
  for (const item of value) {
    const type = (item as any)?.type;
    const id = Number((item as any)?.id);
    if (RELATED_ENTITY_TYPES.includes(type) && Number.isInteger(id) && id > 0) {
      const key = `${type}:${id}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push({ type, id });
      }
    }
  }
  return refs;
}

export async function adminListProducts(_req: Request, res: Response) {
  res.json({ items: await listAdminProductsRepo() });
}

export async function adminGetProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  const product = (await listAdminProductsRepo()).find((item) => item.id === id);
  if (!product) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const relatedItems = await listRelatedLinksForSourceRepo("product", id);
  return res.json({ ...product, relatedItems });
}

export async function adminUpsertProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    const productNameAr = incoming.name?.ar ?? incoming.arName ?? "";
    const productNameEn = incoming.name?.en ?? incoming.enName ?? "";
    const resolvedSlug = toSlug(incoming.slug || productNameEn || productNameAr);
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
    await db.transaction(async (tx) => {
      const product = await createAdminProductRepo({
        id: incoming.id ? Number(incoming.id) : undefined,
        sku: incoming.sku ?? "",
        slug: resolvedSlug,
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
        hoverImagePath: incoming.hoverImagePath ?? null,
        media: Array.isArray(incoming.media)
          ? incoming.media
            .map((item: any) => ({
              type: item?.type === "video" ? "video" : "image",
              url: String(item?.url ?? "").trim()
            }))
            .filter((item: any) => item.url)
          : undefined,
        categoryId: Number(incoming.categoryId ?? 0),
        status: productStatus,
        isNew: incoming.isNew ?? false,
        isBestseller: incoming.isBestseller ?? false
      }, tx);
      await replaceVariantsRepo(
        product.id,
        productVariants.map((v: any) => ({
          id: v.id ? Number(v.id) : undefined,
          sizeLabel: v.sizeLabel ?? v.size ?? "",
          sellingPrice: Number(v.sellingPrice ?? v.price ?? 0),
          stockQty: Number(v.stockQty ?? v.stock ?? 0)
        })),
        tx
      );
      if (Object.prototype.hasOwnProperty.call(incoming, "relatedItems")) {
        const relatedRefs = parseRelatedItems(incoming.relatedItems).filter(
          (target) => !(target.type === "product" && target.id === product.id)
        );
        await setRelatedLinksForSourceRepo({ type: "product", id: product.id }, relatedRefs, tx);
      }
      return product;
    });
    try {
      await triggerStorefrontProductRevalidation(resolvedSlug);
    } catch (error) {
      console.warn("Failed to trigger storefront revalidation for product", resolvedSlug, error);
    }
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "PRODUCT_VARIANT_LINKED_TO_OFFERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-offers" });
    }
    next(error);
  }
}

export async function adminSoftDeleteProduct(req: Request, res: Response, next: NextFunction) {
  const { softDeleteProductRepo } = await import("../../../repositories/product.repository.js");
  try {
    await softDeleteProductRepo(Number(req.params.id));
  } catch (error: any) {
    if (error?.code === "PRODUCT_LINKED_TO_OFFERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-offers" });
    }
    return next(error);
  }
  res.json({ ok: true });
}

export async function adminRestoreProduct(req: Request, res: Response) {
  const { restoreProductRepo } = await import("../../../repositories/product.repository.js");
  await restoreProductRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminHardDeleteProduct(req: Request, res: Response, next: NextFunction) {
  const { hardDeleteProductRepo } = await import("../../../repositories/product.repository.js");
  let result;
  try {
    result = await hardDeleteProductRepo(Number(req.params.id));
  } catch (error: any) {
    if (error?.code === "PRODUCT_LINKED_TO_OFFERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-offers" });
    }
    if (error?.code === "PRODUCT_LINKED_TO_ORDERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-orders" });
    }
    return next(error);
  }
  if (!result) {
    return res.status(404).json({ ok: false, reason: "not-in-trash" });
  }
  if (result.imagePath && result.imagePath.startsWith("/uploads/")) {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const uploadsDir = path.resolve(process.cwd(), "uploads");
    const fileName = result.imagePath.slice("/uploads/".length);
    const absolutePath = path.resolve(uploadsDir, fileName);
    const relativePath = path.relative(uploadsDir, absolutePath);
    try {
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        console.warn(`Skipped unlink outside uploads directory: ${absolutePath}`);
      } else {
        await fs.unlink(absolutePath);
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        console.warn(`Failed to unlink product image ${absolutePath}:`, err?.message ?? err);
      }
    }
  }
  res.status(204).end();
}

export async function adminToggleProductStatus(req: Request, res: Response) {
  const { toggleProductStatusRepo } = await import("../../../repositories/product.repository.js");
  await toggleProductStatusRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function adminSetVariantStock(req: Request, res: Response) {
  const variantId = Number(req.params.variantId);
  const stock = Math.max(0, Number(req.body?.stock ?? 0));
  const { setVariantStockRepo } = await import("../../../repositories/product.repository.js");
  await setVariantStockRepo(variantId, stock);
  res.json({ ok: true });
}
