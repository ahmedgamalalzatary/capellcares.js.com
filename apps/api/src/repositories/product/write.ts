import { and, eq, inArray, or, sql } from "drizzle-orm";
import { collectionItems, entityMedia, entityOrderings, offerItems, orderItems, products, productVariants, relatedItems, variantDiscounts, wishlists } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  normalizeMedia,
  normalizeVariantSizeLabel,
  ProductMediaItem,
  replaceProductMediaRepo,
  resolvePrimaryImagePath
} from "./shared.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createAdminProductRepo(input: {
  id?: number;
  sku: string;
  slug: string;
  arName: string;
  enName: string;
  buyingPrice: number;
  keywords: string;
  arDescription?: string | null;
  enDescription?: string | null;
  arIngredients?: string | null;
  enIngredients?: string | null;
  arHowToUse?: string | null;
  enHowToUse?: string | null;
  arWarnings?: string | null;
  enWarnings?: string | null;
  youtubeUrl?: string | null;
  imagePath?: string | null;
  hoverImagePath?: string | null;
  arHoverImagePath?: string | null;
  enHoverImagePath?: string | null;
  media?: ProductMediaItem[];
  categoryId: number;
  status: "active" | "inactive";
  isNew?: boolean;
  isBestseller?: boolean;
}, executor?: DbTransaction) {
  const shouldReplaceMedia = input.media !== undefined || !input.id;
  const mediaUpdate = shouldReplaceMedia
    ? input.media ?? normalizeMedia(undefined, input.imagePath ?? null)
    : undefined;
  const primaryImagePath = mediaUpdate
    ? resolvePrimaryImagePath(mediaUpdate, input.imagePath ?? null)
    : null;
  const hasEnHoverUpdate = input.enHoverImagePath !== undefined || input.hoverImagePath !== undefined;
  const enHoverImagePath = input.enHoverImagePath !== undefined
    ? input.enHoverImagePath
    : input.hoverImagePath ?? null;
  const hasArHoverUpdate = input.arHoverImagePath !== undefined;
  const repo = executor ?? db;

  if (input.id) {
    const id = input.id;
    const [existing] = await repo
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (existing) {
      await repo
        .update(products)
        .set({
          sku: input.sku,
          slug: input.slug,
          arName: input.arName,
          enName: input.enName,
          buyingPrice: sql`${input.buyingPrice}`,
          keywords: input.keywords,
          arDescription: input.arDescription ?? null,
          enDescription: input.enDescription ?? null,
          arIngredients: input.arIngredients ?? null,
          enIngredients: input.enIngredients ?? null,
          arHowToUse: input.arHowToUse ?? null,
          enHowToUse: input.enHowToUse ?? null,
          arWarnings: input.arWarnings ?? null,
          enWarnings: input.enWarnings ?? null,
          youtubeUrl: input.youtubeUrl ?? null,
          ...(shouldReplaceMedia ? { imagePath: primaryImagePath } : {}),
          ...(hasEnHoverUpdate ? { hoverImagePath: enHoverImagePath } : {}),
          ...(hasArHoverUpdate ? { arHoverImagePath: input.arHoverImagePath ?? null } : {}),
          categoryId: input.categoryId,
          status: input.status,
          isNew: input.isNew ?? false,
          isBestseller: input.isBestseller ?? false
        })
        .where(eq(products.id, id));
      if (mediaUpdate) {
        await replaceProductMediaRepo(id, mediaUpdate, executor);
      }
      return { id };
    }
  }

  const [created] = await repo.insert(products).values({
      sku: input.sku,
      slug: input.slug,
      arName: input.arName,
      enName: input.enName,
      buyingPrice: sql`${input.buyingPrice}`,
      keywords: input.keywords,
      arDescription: input.arDescription ?? null,
      enDescription: input.enDescription ?? null,
      arIngredients: input.arIngredients ?? null,
      enIngredients: input.enIngredients ?? null,
      arHowToUse: input.arHowToUse ?? null,
      enHowToUse: input.enHowToUse ?? null,
      arWarnings: input.arWarnings ?? null,
      enWarnings: input.enWarnings ?? null,
      youtubeUrl: input.youtubeUrl ?? null,
      imagePath: primaryImagePath,
      hoverImagePath: enHoverImagePath,
      arHoverImagePath: input.arHoverImagePath ?? null,
      categoryId: input.categoryId,
      status: input.status,
      isNew: input.isNew ?? false,
      isBestseller: input.isBestseller ?? false
    }).$returningId();
  await replaceProductMediaRepo(created.id, mediaUpdate ?? [], executor);
  return created;
}

export async function replaceVariantsRepo(
  productId: number,
  variants: Array<{
    id?: number;
    sizeLabel: string;
    sellingPrice: number;
    stockQty: number;
    discount?: {
      type: "percentage" | "fixed";
      value: number;
      startsAt: string;
      endsAt: string;
      status: "active" | "inactive";
    } | null;
  }>,
  executor?: DbTransaction
) {
  const run = async (tx: DbTransaction) => {
    const existing = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    const existingIds = existing.map((row) => row.id);
    const requestedExistingIds = variants
      .map((variant) => variant.id)
      .filter((id): id is number => typeof id === "number" && existingIds.includes(id));

    const removedIds = existingIds.filter((id) => !requestedExistingIds.includes(id));
    if (removedIds.length > 0) {
      const linkedRows = await tx
        .select({ variantId: offerItems.variantId })
        .from(offerItems)
        .where(inArray(offerItems.variantId, removedIds))
        .limit(1);
      if (linkedRows.length > 0) {
        const error = new Error("linked-to-offers") as Error & { code?: string };
        error.code = "PRODUCT_VARIANT_LINKED_TO_OFFERS";
        throw error;
      }

      const soldRows = await tx
        .select({ variantId: orderItems.variantId })
        .from(orderItems)
        .where(inArray(orderItems.variantId, removedIds));
      const soldIds = [...new Set(soldRows.map((row) => row.variantId).filter((id): id is number => id != null))];
      const hardDeletableIds = removedIds.filter((id) => !soldIds.includes(id));

      if (soldIds.length > 0) {
        await tx
          .update(productVariants)
          .set({ deletedAt: sql`NOW()` })
          .where(inArray(productVariants.id, soldIds));
      }
      if (hardDeletableIds.length > 0) {
        await tx.delete(productVariants).where(inArray(productVariants.id, hardDeletableIds));
      }
    }

    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index]!;
      const sortOrder = index + 1;
      let persistedVariantId = variant.id;
      if (variant.id && existingIds.includes(variant.id)) {
        await tx
          .update(productVariants)
          .set({
            sizeLabel: normalizeVariantSizeLabel(variant.sizeLabel),
            sellingPrice: sql`${variant.sellingPrice}`,
            stockQty: variant.stockQty,
            sortOrder
          })
          .where(eq(productVariants.id, variant.id));
      } else {
        const [createdVariant] = await tx.insert(productVariants).values({
          productId,
          sizeLabel: normalizeVariantSizeLabel(variant.sizeLabel),
          sellingPrice: sql`${variant.sellingPrice}`,
          stockQty: variant.stockQty,
          sortOrder
        }).$returningId();
        persistedVariantId = createdVariant.id;
      }

      if (!persistedVariantId) {
        continue;
      }

      if (variant.discount) {
        const discountValues = {
          variantId: persistedVariantId,
          type: variant.discount.type,
          value: sql`${variant.discount.value}`,
          startsAt: new Date(variant.discount.startsAt),
          endsAt: new Date(variant.discount.endsAt),
          status: variant.discount.status
        };
        const [existingDiscount] = await tx
          .select({ id: variantDiscounts.id })
          .from(variantDiscounts)
          .where(eq(variantDiscounts.variantId, persistedVariantId))
          .limit(1);
        if (existingDiscount) {
          await tx
            .update(variantDiscounts)
            .set(discountValues)
            .where(eq(variantDiscounts.variantId, persistedVariantId));
        } else {
          await tx.insert(variantDiscounts).values(discountValues);
        }
      } else {
        await tx.delete(variantDiscounts).where(eq(variantDiscounts.variantId, persistedVariantId));
      }
    }
  };

  if (executor) {
    await run(executor);
    return;
  }

  await db.transaction(run);
}

export async function softDeleteProductRepo(id: number) {
  const linked = await hasOfferLinkedVariantsForProductRepo(id);
  if (linked) {
    const error = new Error("linked-to-offers") as Error & { code?: string };
    error.code = "PRODUCT_LINKED_TO_OFFERS";
    throw error;
  }
  await db.update(products).set({ deletedAt: sql`NOW()` }).where(eq(products.id, id));
}

export async function restoreProductRepo(id: number) {
  await db.update(products).set({ deletedAt: null }).where(eq(products.id, id));
}

export async function hardDeleteProductRepo(id: number): Promise<{ mediaUrls: string[] } | null> {
  return db.transaction(async (tx) => {
    const linked = await tx
      .select({ variantId: offerItems.variantId })
      .from(offerItems)
      .innerJoin(productVariants, eq(productVariants.id, offerItems.variantId))
      .where(eq(productVariants.productId, id))
      .limit(1);
    if (linked.length > 0) {
      const error = new Error("linked-to-offers") as Error & { code?: string };
      error.code = "PRODUCT_LINKED_TO_OFFERS";
      throw error;
    }

    const sold = await tx
      .select({ variantId: orderItems.variantId })
      .from(orderItems)
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(eq(productVariants.productId, id))
      .limit(1);
    if (sold.length > 0) {
      const error = new Error("linked-to-orders") as Error & { code?: string };
      error.code = "PRODUCT_LINKED_TO_ORDERS";
      throw error;
    }

    const [row] = await tx
      .select({
        imagePath: products.imagePath,
        hoverImagePath: products.hoverImagePath,
        arHoverImagePath: products.arHoverImagePath,
        deletedAt: products.deletedAt
      })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row || row.deletedAt == null) return null;

    const mediaRows = await tx
      .select({ url: entityMedia.url, arUrl: entityMedia.arUrl })
      .from(entityMedia)
      .where(eq(entityMedia.productId, id));

    const variantRows = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    const variantIds = variantRows.map((variant) => variant.id);

    await tx
      .delete(wishlists)
      .where(and(eq(wishlists.entityType, "product"), eq(wishlists.entityId, id)));
    await tx
      .delete(relatedItems)
      .where(
        or(
          and(eq(relatedItems.sourceType, "product"), eq(relatedItems.sourceId, id)),
          and(eq(relatedItems.targetType, "product"), eq(relatedItems.targetId, id))
        )
      );
    await tx
      .delete(entityOrderings)
      .where(and(eq(entityOrderings.entityType, "product"), eq(entityOrderings.entityId, id)));
    if (variantIds.length > 0) {
      await tx.delete(collectionItems).where(inArray(collectionItems.variantId, variantIds));
    }
    await tx.delete(entityMedia).where(eq(entityMedia.productId, id));
    await tx.delete(productVariants).where(eq(productVariants.productId, id));
    await tx.delete(products).where(eq(products.id, id));
    return {
      mediaUrls: [
        row.imagePath,
        row.hoverImagePath,
        row.arHoverImagePath,
        ...mediaRows.flatMap((item) => [item.url, item.arUrl])
      ].filter((url): url is string => Boolean(url))
    };
  });
}

export async function toggleProductStatusRepo(id: number) {
  await db
    .update(products)
    .set({ status: sql`CASE WHEN ${products.status} = 'active' THEN 'inactive' ELSE 'active' END` })
    .where(eq(products.id, id));
}

export async function setVariantStockRepo(productId: number, variantId: number, stockQty: number) {
  const result = await db
    .update(productVariants)
    .set({ stockQty })
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));

  return result[0].affectedRows === 1;
}

async function hasOfferLinkedVariantsForProductRepo(productId: number) {
  const linked = await db
    .select({ variantId: offerItems.variantId })
    .from(offerItems)
    .innerJoin(productVariants, eq(productVariants.id, offerItems.variantId))
    .where(eq(productVariants.productId, productId))
    .limit(1);
  return linked.length > 0;
}
