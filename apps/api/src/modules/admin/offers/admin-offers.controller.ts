import type { NextFunction, Request, Response } from "express";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { offerItems, offers, productVariants, products } from "@capella/database/drizzle/schema";
import { getCategoryByIdRepo, listDescendantCategoryIdsRepo } from "../../../repositories/category.repository.js";
import {
  findOfferByIdRepo,
  hardDeleteOfferRepo,
  listOffersRepo,
  reorderOffersRepo,
  restoreOfferRepo,
  softDeleteOfferRepo,
  upsertOfferRepo
} from "../../../repositories/offer.repository.js";
import {
  listRelatedLinksForSourceRepo,
  setRelatedLinksForSourceRepo
} from "../../../repositories/related-item.repository.js";
import { toSlug } from "../../../services/slug.service.js";
import { calculateBundleInventory, computeBundleInventoryFromMap, validateBundlePriceBelowParts } from "../../inventory/bundle-inventory.js";
import { isDuplicateEntryError } from "../shared/db-errors.js";
import { parseRelatedItems } from "../shared/related-items.js";
import { toAdminOffer } from "../offers/admin-offers.mapper.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";
import { parseEntityMediaInput } from "../../../repositories/entity-media.repository.js";

async function findOfferRevalidationData(id: number): Promise<{ slug: string; relatedProductSlugs: string[] } | null> {
  const [offer] = await db.select({ slug: offers.slug }).from(offers).where(eq(offers.id, id)).limit(1);
  if (!offer) {
    return null;
  }

  const itemRows = await db.select({ variantId: offerItems.variantId }).from(offerItems).where(eq(offerItems.offerId, id));
  const variantIds = [...new Set(itemRows.map((row) => row.variantId))];
  const relatedProductSlugs = variantIds.length === 0
    ? []
    : [
        ...new Set(
          (
            await db
              .select({ slug: products.slug })
              .from(productVariants)
              .innerJoin(products, eq(products.id, productVariants.productId))
              .where(inArray(productVariants.id, variantIds))
          ).map((row) => row.slug)
        )
      ];

  return { slug: offer.slug, relatedProductSlugs };
}

async function safeTriggerOfferRevalidation(payload: { slug: string; relatedProductSlugs?: string[] }) {
  try {
    await triggerStorefrontRevalidation({
      entity: "offer",
      slug: payload.slug,
      relatedProductSlugs: payload.relatedProductSlugs
    });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for offer", payload.slug, error);
  }
}

async function validateOfferItems(categoryId: number, items: Array<{ variantId: number; qty: number }>) {
  if (items.length === 0) {
    return "offer-min-one-variant";
  }

  for (const item of items) {
    if (!Number.isInteger(item.variantId) || item.variantId < 1) {
      return "offer-item-invalid-variant";
    }
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      return "offer-item-invalid-qty";
    }
  }

  const variantIdsDistinct = [...new Set(items.map((item) => item.variantId))];

  const rows = await db
    .select({
      variantId: productVariants.id,
      categoryId: products.categoryId
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(inArray(productVariants.id, variantIdsDistinct), isNull(productVariants.deletedAt), isNull(products.deletedAt)));

  if (rows.length !== variantIdsDistinct.length) {
    return "offer-item-not-found";
  }

  const allowedCategoryIds = new Set(await listDescendantCategoryIdsRepo(categoryId));
  if (rows.some((row) => !allowedCategoryIds.has(row.categoryId))) {
    return "offer-item-category-mismatch";
  }

  return null;
}

async function validateOfferCategory(categoryId: number) {
  if (!Number.isInteger(categoryId) || categoryId < 1) {
    return "offer-category-must-be-root";
  }

  const category = await getCategoryByIdRepo(categoryId);
  if (!category || category.parentId != null) {
    return "offer-category-must-be-root";
  }

  return null;
}

export async function adminReorderOffers(req: Request, res: Response, next: NextFunction) {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown): number => Number(value))
      : [];

    if (ids.length === 0 || ids.some((id: number) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ ok: false, reason: "invalid-offer-order" });
    }

    await reorderOffersRepo({ ids });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "INVALID_OFFER_ORDER") {
      return res.status(400).json({ ok: false, reason: "invalid-offer-order" });
    }
    next(error);
  }
}

export async function adminListOffers(_req: Request, res: Response) {
  const offers = await listOffersRepo(true);
  const variantIds = [...new Set(offers.flatMap((offer) => offer.items.map((item) => item.variantId)))];
  const variantRows = variantIds.length === 0
    ? []
    : await db
        .select({
          id: productVariants.id,
          sellingPrice: productVariants.sellingPrice,
          stockQty: productVariants.stockQty
        })
        .from(productVariants)
        .where(inArray(productVariants.id, variantIds));
  const variantMap = new Map(variantRows.map((row) => [row.id, row] as const));
  const items = offers.map((offer) => {
    const inventory = computeBundleInventoryFromMap(offer.items, variantMap);
    return toAdminOffer(offer, inventory.originalTotal, inventory.stock);
  });
  res.json({ items });
}

export async function adminGetOffer(req: Request, res: Response) {
  const id = Number(req.params.id);
  const offer = await findOfferByIdRepo(id);
  if (!offer) {
    return res.status(404).json({ ok: false, reason: "not-found" });
  }

  const inventory = await calculateBundleInventory(offer.items);
  const relatedItems = await listRelatedLinksForSourceRepo("offer", id);
  return res.json({ ...toAdminOffer(offer, inventory.originalTotal, inventory.stock), relatedItems });
}

export async function adminUpsertOffer(req: Request, res: Response, next: NextFunction) {
  try {
    const incoming = req.body as any;
    const slug = toSlug(incoming.slug || incoming.name?.en || incoming.enName || incoming.name?.ar || incoming.arName);
    const fixedPrice = Number(incoming.price ?? incoming.fixedPrice ?? 0);
    if (!Number.isFinite(fixedPrice) || fixedPrice < 0) {
      return res.status(400).json({ ok: false, reason: "invalid-fixed-price" });
    }
    const items = (incoming.items ?? []).map((item: any) => ({
      id: item.id ? Number(item.id) : undefined,
      variantId: Number(item.variantId),
      qty: Number(item.qty)
    }));

    const categoryId = Number(incoming.categoryId ?? 0);
    const categoryError = await validateOfferCategory(categoryId);
    if (categoryError) {
      return res.status(400).json({ ok: false, reason: categoryError });
    }

    const validationError = await validateOfferItems(categoryId, items);
    if (validationError) {
      return res.status(400).json({ ok: false, reason: validationError });
    }

    const priceError = await validateBundlePriceBelowParts(fixedPrice, items);
    if (priceError) {
      return res.status(400).json({ ok: false, reason: priceError });
    }

    const { id: offerId } = await upsertOfferRepo({
      id: incoming.id,
      slug,
      arName: incoming.name?.ar ?? incoming.arName ?? "",
      enName: incoming.name?.en ?? incoming.enName ?? "",
      arDescription: incoming.description?.ar ?? incoming.arDescription ?? null,
      enDescription: incoming.description?.en ?? incoming.enDescription ?? null,
      imagePath: incoming.imagePath ?? null,
      media: parseEntityMediaInput(incoming.media),
      fixedPrice,
      categoryId,
      status: incoming.status ?? "inactive",
      visibility: incoming.visibility,
      items
    });
    if (Object.prototype.hasOwnProperty.call(incoming, "relatedItems")) {
      const relatedRefs = parseRelatedItems(incoming.relatedItems).filter(
        (target) => !(target.type === "offer" && target.id === offerId)
      );
      await setRelatedLinksForSourceRepo({ type: "offer", id: offerId }, relatedRefs);
    }
    const revalidation = await findOfferRevalidationData(offerId);
    await safeTriggerOfferRevalidation(revalidation ?? { slug });
    res.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "ENTITY_MEDIA_VIDEO_LIMIT") {
      return res.status(400).json({ ok: false, reason: "media-video-limit" });
    }
    if (isDuplicateEntryError(error)) {
      return res.status(409).json({ ok: false, reason: "slug-conflict" });
    }
    if ((error as { code?: string })?.code === "OFFER_CATEGORY_MUST_BE_ROOT") {
      return res.status(400).json({ ok: false, reason: "offer-category-must-be-root" });
    }
    next(error);
  }
}

export async function adminSoftDeleteOffer(req: Request, res: Response) {
  const revalidation = await findOfferRevalidationData(Number(req.params.id));
  await softDeleteOfferRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerOfferRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminRestoreOffer(req: Request, res: Response) {
  const revalidation = await findOfferRevalidationData(Number(req.params.id));
  await restoreOfferRepo(Number(req.params.id));
  if (revalidation) {
    await safeTriggerOfferRevalidation(revalidation);
  }
  res.json({ ok: true });
}

export async function adminHardDeleteOffer(req: Request, res: Response) {
  const revalidation = await findOfferRevalidationData(Number(req.params.id));
  const result = await hardDeleteOfferRepo(Number(req.params.id));
  if (!result) {
    return res.status(404).json({ ok: false, reason: "not-in-trash" });
  }
  const { deleteLocalUploadUrls } = await import("../../uploads/uploads.service.js");
  await deleteLocalUploadUrls(result.mediaUrls);
  if (revalidation) {
    await safeTriggerOfferRevalidation(revalidation);
  }
  res.status(204).end();
}

export async function adminToggleOfferStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { toggleOfferStatusRepo } = await import("../../../repositories/offer.repository.js");
    const revalidation = await findOfferRevalidationData(Number(req.params.id));
    await toggleOfferStatusRepo(Number(req.params.id));
    if (revalidation) {
      await safeTriggerOfferRevalidation(revalidation);
    }
    res.json({ ok: true });
  } catch (error) {
    if ((error as { code?: string })?.code === "OFFER_CATEGORY_REQUIRED") {
      return res.status(400).json({ ok: false, reason: "offer-category-required" });
    }
    next(error);
  }
}
