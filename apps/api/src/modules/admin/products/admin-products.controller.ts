import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { products } from "@capella/database/drizzle/schema";
import { listCategoriesRepo } from "../../../repositories/category.repository.js";
import {
  createAdminProductRepo,
  findAdminProductByIdRepo,
  listAdminProductsRepo,
  replaceVariantsRepo
} from "../../../repositories/product.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";
import { parseRelatedItems } from "../shared/related-items.js";

async function buildCategorySlugs(categoryId: number): Promise<string[]> {
  const categories = await listCategoriesRepo(true);
  return buildCategorySlugsFromMap(categoryId, new Map(categories.map((category) => [category.id, category])));
}

function buildCategorySlugsFromMap(
  categoryId: number,
  byId: Map<number, { id: number; slug: string; parentId: number | null }>
): string[] {
  const slugs: string[] = [];
  const seen = new Set<number>();
  let current = byId.get(categoryId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    slugs.unshift(current.slug);
    current = current.parentId != null ? byId.get(current.parentId) : undefined;
  }

  return slugs;
}

async function findProductRevalidationData(
  id: number,
  categoryById?: Map<number, { id: number; slug: string; parentId: number | null }>
): Promise<{ slug: string; categorySlugs: string[] } | null> {
  const [product] = await db
    .select({ slug: products.slug, categoryId: products.categoryId })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product) {
    return null;
  }

  return {
    slug: product.slug,
    categorySlugs: categoryById
      ? buildCategorySlugsFromMap(product.categoryId, categoryById)
      : await buildCategorySlugs(product.categoryId)
  };
}

async function safeTriggerProductRevalidation(payload: {
  slug: string;
  previousSlug?: string;
  categorySlugs?: string[];
}) {
  try {
    await triggerStorefrontRevalidation({
      entity: "product",
      slug: payload.slug,
      previousSlug: payload.previousSlug,
      categorySlugs: payload.categorySlugs
    });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for product", payload.slug, error);
  }
}

export async function adminListProducts(_req: Request, res: Response) {
  res.json({ items: await listAdminProductsRepo() });
}

export async function adminGetProduct(req: Request, res: Response) {
  const id = Number(req.params.id);
  const product = await findAdminProductByIdRepo(id);
  if (!product) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const relatedItems = await listRelatedLinksForSourceRepo("product", id);
  return res.json({ ...product, relatedItems });
}

export async function adminUpsertProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    const categories = incoming.id || incoming.categoryId != null ? await listCategoriesRepo(true) : [];
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const existingRevalidation = incoming.id
      ? await findProductRevalidationData(Number(incoming.id), categoryById)
      : null;
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
    const nextCategorySlugs = incoming.categoryId != null
      ? buildCategorySlugsFromMap(Number(incoming.categoryId), categoryById)
      : existingRevalidation?.categorySlugs ?? [];
    await safeTriggerProductRevalidation({
      slug: resolvedSlug,
      previousSlug: existingRevalidation && existingRevalidation.slug !== resolvedSlug
        ? existingRevalidation.slug
        : undefined,
      categorySlugs: [...new Set([...(existingRevalidation?.categorySlugs ?? []), ...nextCategorySlugs])]
    });
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
  const revalidation = await findProductRevalidationData(Number(req.params.id));
  try {
    await softDeleteProductRepo(Number(req.params.id));
  } catch (error: any) {
    if (error?.code === "PRODUCT_LINKED_TO_OFFERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-offers" });
    }
    return next(error);
  }
  if (revalidation) {
    await safeTriggerProductRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminRestoreProduct(req: Request, res: Response) {
  const { restoreProductRepo } = await import("../../../repositories/product.repository.js");
  const revalidation = await findProductRevalidationData(Number(req.params.id));
  await restoreProductRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerProductRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminHardDeleteProduct(req: Request, res: Response, next: NextFunction) {
  const { hardDeleteProductRepo } = await import("../../../repositories/product.repository.js");
  const revalidation = await findProductRevalidationData(Number(req.params.id));
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
  if (revalidation) {
    await safeTriggerProductRevalidation(revalidation);
  }
  res.status(204).end();
}

export async function adminToggleProductStatus(req: Request, res: Response) {
  const { toggleProductStatusRepo } = await import("../../../repositories/product.repository.js");
  const revalidation = await findProductRevalidationData(Number(req.params.id));
  await toggleProductStatusRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerProductRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminSetVariantStock(req: Request, res: Response) {
  const productId = Number(req.params.id);
  const variantId = Number(req.params.variantId);
  const stock = Math.max(0, Number(req.body?.stock ?? 0));
  const { setVariantStockRepo } = await import("../../../repositories/product.repository.js");
  const updated = await setVariantStockRepo(productId, variantId, stock);
  if (!updated) {
    return res.status(404).json({ message: "Variant not found" });
  }
  res.json({ ok: true });
}
