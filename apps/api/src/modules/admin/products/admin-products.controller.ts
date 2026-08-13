import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { entityMedia, products } from "@capella/database/drizzle/schema";
import { listCategoriesRepo } from "../../../repositories/category.repository.js";
import { buildLineage } from "../../../repositories/category-tree.js";
import {
  createAdminProductRepo,
  findAdminProductByIdRepo,
  listAdminProductsRepo,
  reorderProductsRepo,
  replaceVariantsRepo
} from "../../../repositories/product.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";
import { parseEntityMediaInput } from "../../../repositories/entity-media.repository.js";
import { parseRelatedItems } from "../shared/related-items.js";

type NormalizedVariantDiscount = {
  type: "percentage" | "fixed";
  value: number;
  startsAt: string;
  endsAt: string;
  status: "active" | "inactive";
};

function validateVariantDiscount(input: unknown, sellingPrice: number): { ok: true; value: NormalizedVariantDiscount | null } | { ok: false } {
  if (input == null) {
    return { ok: true as const, value: null };
  }

  const discount = input as {
    type?: unknown;
    value?: unknown;
    startsAt?: unknown;
    endsAt?: unknown;
    status?: unknown;
  };
  const type = discount.type;
  const value = Number(discount.value);
  const startsAt = new Date(String(discount.startsAt ?? ""));
  const endsAt = new Date(String(discount.endsAt ?? ""));
  const status = discount.status;

  if (type !== "percentage" && type !== "fixed") return { ok: false as const };
  if (!Number.isFinite(value) || value <= 0) return { ok: false as const };
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) return { ok: false as const };
  if (!(endsAt instanceof Date) || Number.isNaN(endsAt.getTime())) return { ok: false as const };
  if (startsAt >= endsAt) return { ok: false as const };
  if (status !== "active" && status !== "inactive") return { ok: false as const };
  if (type === "percentage" && value > 100) return { ok: false as const };
  if (type === "fixed" && value >= sellingPrice) return { ok: false as const };

  return {
    ok: true as const,
    value: {
      type,
      value,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status
    }
  };
}

async function buildCategorySlugs(categoryId: number): Promise<string[]> {
  const categories = await listCategoriesRepo(true);
  return buildCategorySlugsFromMap(categoryId, new Map(categories.map((category) => [category.id, category])));
}

function buildCategorySlugsFromMap(
  categoryId: number,
  byId: Map<number, { id: number; slug: string; parentId: number | null }>
): string[] {
  return buildLineage(categoryId, [...byId.values()]).map((category) => category.slug);
}

async function findProductRevalidationData(
  id: number,
  categoryById?: Map<number, { id: number; slug: string; parentId: number | null }>
): Promise<{ slug: string; imagePath: string | null; hasLocalizedImage: boolean; categorySlugs: string[] } | null> {
  const [product] = await db
    .select({ slug: products.slug, imagePath: products.imagePath, categoryId: products.categoryId })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product) {
    return null;
  }
  const mediaRows = await db
    .select({ mediaType: entityMedia.mediaType, url: entityMedia.url, arUrl: entityMedia.arUrl })
    .from(entityMedia)
    .where(eq(entityMedia.productId, id));

  return {
    slug: product.slug,
    imagePath: product.imagePath,
    hasLocalizedImage: mediaRows.some((item) => item.mediaType === "image" && Boolean(item.url || item.arUrl)),
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
    const normalizedMedia = parseEntityMediaInput(incoming.media);
    const hasImagePathInput = Object.prototype.hasOwnProperty.call(incoming, "imagePath");
    const hasMediaInput = Object.prototype.hasOwnProperty.call(incoming, "media");
    const hasLegacyHoverInput = Object.prototype.hasOwnProperty.call(incoming, "hoverImagePath");
    const hasArHoverInput = Object.prototype.hasOwnProperty.call(incoming, "arHoverImagePath");
    const hasEnHoverInput = Object.prototype.hasOwnProperty.call(incoming, "enHoverImagePath");
    const selectedImage = normalizedMedia?.find((item) => item.type === "image");
    const productImagePath = hasMediaInput
      ? selectedImage?.enUrl ?? null
      : hasImagePathInput
        ? incoming.imagePath
        : existingRevalidation?.imagePath ?? null;
    const hasLocalizedProductImage = hasMediaInput
      ? Boolean(selectedImage?.arUrl || selectedImage?.enUrl)
      : hasImagePathInput
        ? Boolean(incoming.imagePath)
        : existingRevalidation?.hasLocalizedImage ?? Boolean(productImagePath);
    const mediaUpdate = hasMediaInput
      ? normalizedMedia
      : hasImagePathInput
        ? productImagePath
          ? [{ type: "image" as const, arUrl: null, enUrl: productImagePath }]
          : []
        : undefined;
    if (
      productStatus === "active" &&
      (
        !productNameAr ||
        !productNameEn ||
        productKeywords.length === 0 ||
        !hasLocalizedProductImage ||
        !incoming.categoryId ||
        productVariants.length === 0
      )
    ) {
      return res.status(400).json({ ok: false, reason: "cannot-activate-incomplete-product" });
    }
    for (const variant of productVariants) {
      const price = Number(variant?.sellingPrice ?? variant?.price ?? 0);
      const discountValidation = validateVariantDiscount(variant?.discount, price);
      if (!discountValidation.ok) {
        return res.status(400).json({ ok: false, reason: "invalid-variant-discount" });
      }
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
        imagePath: productImagePath,
        hoverImagePath: hasLegacyHoverInput ? incoming.hoverImagePath ?? null : undefined,
        arHoverImagePath: hasArHoverInput ? incoming.arHoverImagePath ?? null : undefined,
        enHoverImagePath: hasEnHoverInput
          ? incoming.enHoverImagePath ?? null
          : hasLegacyHoverInput
            ? incoming.hoverImagePath ?? null
            : undefined,
        media: mediaUpdate,
        categoryId: Number(incoming.categoryId ?? 0),
        status: productStatus,
        isNew: incoming.isNew ?? false,
        isBestseller: incoming.isBestseller ?? false
      }, tx);
      await replaceVariantsRepo(
        product.id,
        productVariants.map((v: any) => {
          const validatedDiscount = validateVariantDiscount(v.discount, Number(v.sellingPrice ?? v.price ?? 0));
          return {
            id: v.id ? Number(v.id) : undefined,
            sizeLabel: v.sizeLabel ?? v.size ?? "",
            sellingPrice: Number(v.sellingPrice ?? v.price ?? 0),
            stockQty: Number(v.stockQty ?? v.stock ?? 0),
            discount: validatedDiscount.ok ? validatedDiscount.value : null
          };
        }),
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
    if (error?.code === "ENTITY_MEDIA_VIDEO_LIMIT") {
      return res.status(400).json({ ok: false, reason: "media-video-limit" });
    }
    if (error?.code === "PRODUCT_VARIANT_LINKED_TO_OFFERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-offers" });
    }
    next(error);
  }
}

export async function adminReorderProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown): number => Number(value))
      : [];
    const categoryIdRaw = req.body?.categoryId;
    const categoryId = categoryIdRaw == null || categoryIdRaw === ""
      ? null
      : Number(categoryIdRaw);

    if (
      ids.length === 0 ||
      ids.some((id: number) => !Number.isInteger(id) || id <= 0) ||
      (categoryId !== null && (!Number.isInteger(categoryId) || categoryId <= 0))
    ) {
      return res.status(400).json({ ok: false, reason: "invalid-product-order" });
    }

    await reorderProductsRepo({ categoryId, ids });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "INVALID_PRODUCT_ORDER") {
      return res.status(400).json({ ok: false, reason: "invalid-product-order" });
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
    if (error?.code === "PRODUCT_LINKED_TO_COLLECTIONS") {
      return res.status(409).json({ ok: false, reason: "linked-to-collections" });
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
    if (error?.code === "PRODUCT_LINKED_TO_COLLECTIONS") {
      return res.status(409).json({ ok: false, reason: "linked-to-collections" });
    }
    if (error?.code === "PRODUCT_LINKED_TO_ORDERS") {
      return res.status(409).json({ ok: false, reason: "linked-to-orders" });
    }
    return next(error);
  }
  if (!result) {
    return res.status(404).json({ ok: false, reason: "not-in-trash" });
  }
  const { deleteLocalUploadUrls } = await import("../../uploads/uploads.service.js");
  await deleteLocalUploadUrls(result.mediaUrls);
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

export async function adminUpdateProductDiscounts(req: Request, res: Response) {
  const id = Number(req.params.id);
  const product = await findAdminProductByIdRepo(id);
  if (!product) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  type DiscountVariantInput = {
    id?: number;
    discount?: unknown;
    sellingPrice?: number;
    price?: number;
  };
  const incomingVariants: DiscountVariantInput[] = Array.isArray(req.body?.variants) ? req.body.variants : [];
  const byId = new Map(incomingVariants
    .map((variant: DiscountVariantInput) => [Number(variant?.id), variant] as const)
    .filter(([variantId]) => Number.isInteger(variantId) && variantId > 0));

  for (const existingVariant of product.variants) {
    const incoming = byId.get(existingVariant.id);
    if (!incoming) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "discount")) {
      const discountValidation = validateVariantDiscount(incoming.discount, existingVariant.price);
      if (!discountValidation.ok) {
        return res.status(400).json({ ok: false, reason: "invalid-variant-discount" });
      }
    }
  }

  await replaceVariantsRepo(
    product.id,
    product.variants.map((variant) => {
      const incoming = byId.get(variant.id);
      const existingDiscount = variant.discount
        ? {
          type: variant.discount.type as "percentage" | "fixed",
          value: variant.discount.value,
          startsAt: variant.discount.startsAt,
          endsAt: variant.discount.endsAt,
          status: variant.discount.status as "active" | "inactive"
        }
        : null;
      return {
        id: variant.id,
        sizeLabel: variant.size,
        sellingPrice: variant.price,
        stockQty: variant.stock,
        discount: incoming && Object.prototype.hasOwnProperty.call(incoming, "discount")
          ? (() => {
            const validatedDiscount = validateVariantDiscount(incoming.discount, variant.price);
            return validatedDiscount.ok ? validatedDiscount.value : null;
          })()
          : existingDiscount
      };
    })
  );

  await safeTriggerProductRevalidation({
    slug: product.slug,
    categorySlugs: await buildCategorySlugs(product.categoryId)
  });
  res.json({ ok: true });
}
