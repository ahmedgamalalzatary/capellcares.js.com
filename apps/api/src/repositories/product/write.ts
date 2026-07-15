import { and, eq, inArray, sql } from "drizzle-orm";
import { collectionItems, offerItems, orderItems, productColors, productMedia, productSizes, products, productVariants, wishlists } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import {
  normalizeMedia,
  normalizeVariantSizeLabel,
  ProductMediaItem,
  replaceProductMediaRepo,
  resolvePrimaryImagePath
} from "./shared.js";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function invalidProductOptions(message: string) {
  const error = new Error(message) as Error & { code?: string };
  error.code = "INVALID_PRODUCT_OPTIONS";
  return error;
}

function validateProductOptions(
  sizes: Array<{ id: number; label: string }>,
  colors: Array<{ id: number; hex: string }>,
  variants: Array<{ sellingPrice: number; stockQty: number }>
) {
  const normalizedSizes = sizes.map((size) => normalizeVariantSizeLabel(size.label));
  if (
    normalizedSizes.some((label) => label.length === 0) ||
    new Set(sizes.map((size) => size.id)).size !== sizes.length ||
    new Set(normalizedSizes.map((label) => label.toLocaleLowerCase())).size !== sizes.length
  ) {
    throw invalidProductOptions("Product sizes must be nonempty and unique");
  }
  if (
    new Set(colors.map((color) => color.id)).size !== colors.length ||
    colors.some((color) => !/^#[0-9A-F]{6}$/.test(color.hex)) ||
    new Set(colors.map((color) => color.hex)).size !== colors.length
  ) {
    throw invalidProductOptions("Product colors must be canonical and unique hexadecimal values");
  }
  if (variants.some((variant) =>
    !Number.isFinite(variant.sellingPrice) || variant.sellingPrice < 0 ||
    !Number.isInteger(variant.stockQty) || variant.stockQty < 0
  )) {
    throw invalidProductOptions("Variant prices and stock must be nonnegative numbers");
  }
}

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
  media?: ProductMediaItem[];
  categoryId: number;
  status: "active" | "inactive";
  isNew?: boolean;
  isBestseller?: boolean;
}, executor?: DbTransaction) {
  const media = input.media ?? normalizeMedia(undefined, input.imagePath ?? null);
  const primaryImagePath = resolvePrimaryImagePath(media, input.imagePath ?? null);
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
          imagePath: primaryImagePath,
          hoverImagePath: input.hoverImagePath ?? null,
          categoryId: input.categoryId,
          status: input.status,
          isNew: input.isNew ?? false,
          isBestseller: input.isBestseller ?? false
        })
        .where(eq(products.id, id));
      await replaceProductMediaRepo(id, media, executor);
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
      hoverImagePath: input.hoverImagePath ?? null,
      categoryId: input.categoryId,
      status: input.status,
      isNew: input.isNew ?? false,
      isBestseller: input.isBestseller ?? false
    }).$returningId();
  await replaceProductMediaRepo(created.id, media, executor);
  return created;
}

export async function replaceVariantsRepo(
  productId: number,
  variants: Array<{ id?: number; sizeLabel: string; sellingPrice: number; stockQty: number }>,
  executor?: DbTransaction
) {
  const repo = executor ?? db;
  const existing = await repo.select({
    id: productVariants.id,
    sizeId: productVariants.sizeId,
    sizeLabel: productSizes.sizeLabel
  }).from(productVariants)
    .innerJoin(productSizes, eq(productSizes.id, productVariants.sizeId))
    .where(eq(productVariants.productId, productId));
  const sizeIdByVariantId = new Map(existing.map((row) => [row.id, row.sizeId]));
  const claimedExistingIds = new Set<number>();
  const resolvedVariants = variants.map((variant) => {
    const byId = variant.id != null ? existing.find((row) => row.id === variant.id) : undefined;
    const normalizedLabel = normalizeVariantSizeLabel(variant.sizeLabel);
    const byLabel = existing.find((row) =>
      !claimedExistingIds.has(row.id) && normalizeVariantSizeLabel(row.sizeLabel) === normalizedLabel
    );
    const matched = byId ?? byLabel;
    if (matched) claimedExistingIds.add(matched.id);
    return { ...variant, id: matched?.id ?? variant.id, resolvedSizeId: matched?.sizeId };
  });
  const sizes = resolvedVariants.map((variant, index) => ({
    id: variant.resolvedSizeId ?? -(index + 1),
    label: variant.sizeLabel
  }));
  await replaceProductOptionsAndVariantsRepo(
    productId,
    sizes,
    [],
    resolvedVariants.map((variant, index) => ({
      id: variant.id,
      sizeId: sizes[index]!.id,
      colorId: null,
      sellingPrice: variant.sellingPrice,
      stockQty: variant.stockQty
    })),
    executor
  );
}

export async function replaceProductOptionsAndVariantsRepo(
  productId: number,
  sizes: Array<{ id: number; label: string }>,
  colors: Array<{ id: number; hex: string }>,
  variants: Array<{
    id?: number;
    sizeId: number;
    colorId: number | null;
    sellingPrice: number;
    stockQty: number;
  }>,
  executor?: DbTransaction
) {
  validateProductOptions(sizes, colors, variants);
  const run = async (tx: DbTransaction) => {
    const expectedCombinations = sizes.flatMap((size) =>
      colors.length === 0
        ? [`${size.id}:null`]
        : colors.map((color) => `${size.id}:${color.id}`)
    );
    const requestedCombinations = variants.map((variant) =>
      `${variant.sizeId}:${variant.colorId == null ? "null" : variant.colorId}`
    );
    if (
      new Set(requestedCombinations).size !== requestedCombinations.length ||
      requestedCombinations.length !== expectedCombinations.length ||
      expectedCombinations.some((combination) => !requestedCombinations.includes(combination))
    ) {
      throw new Error("Product variants must contain the complete size and color matrix");
    }

    const existingSizes = await tx.select({ id: productSizes.id }).from(productSizes)
      .where(eq(productSizes.productId, productId));
    const existingSizeIds = new Set(existingSizes.map((row) => row.id));
    const sizeIds = new Map<number, number>();
    for (let index = 0; index < sizes.length; index += 1) {
      const size = sizes[index]!;
      if (existingSizeIds.has(size.id)) {
        await tx.update(productSizes).set({
          sizeLabel: normalizeVariantSizeLabel(size.label),
          sortOrder: index + 1,
          deletedAt: null
        }).where(and(eq(productSizes.id, size.id), eq(productSizes.productId, productId)));
        sizeIds.set(size.id, size.id);
      } else {
        const [created] = await tx.insert(productSizes).values({
          productId,
          sizeLabel: normalizeVariantSizeLabel(size.label),
          sortOrder: index + 1
        }).$returningId();
        sizeIds.set(size.id, created.id);
      }
    }

    const existingColors = await tx.select({ id: productColors.id }).from(productColors)
      .where(eq(productColors.productId, productId));
    const existingColorIds = new Set(existingColors.map((row) => row.id));
    const colorIds = new Map<number, number>();
    for (let index = 0; index < colors.length; index += 1) {
      const color = colors[index]!;
      if (existingColorIds.has(color.id)) {
        await tx.update(productColors).set({
          colorHex: color.hex,
          sortOrder: index + 1,
          deletedAt: null
        }).where(and(eq(productColors.id, color.id), eq(productColors.productId, productId)));
        colorIds.set(color.id, color.id);
      } else {
        const [created] = await tx.insert(productColors).values({
          productId,
          colorHex: color.hex,
          sortOrder: index + 1
        }).$returningId();
        colorIds.set(color.id, created.id);
      }
    }

    const existingVariants = await tx.select({ id: productVariants.id }).from(productVariants)
      .where(eq(productVariants.productId, productId));
    const existingVariantIds = new Set(existingVariants.map((row) => row.id));
    const requestedExistingVariantIds = variants
      .map((variant) => variant.id)
      .filter((id): id is number => id != null && existingVariantIds.has(id));
    const removedVariantIds = existingVariants
      .map((row) => row.id)
      .filter((id) => !requestedExistingVariantIds.includes(id));
    if (removedVariantIds.length > 0) {
      const linkedRows = await tx.select({ id: offerItems.id }).from(offerItems)
        .where(inArray(offerItems.variantId, removedVariantIds)).limit(1);
      if (linkedRows.length > 0) {
        const error = new Error("linked-to-offers") as Error & { code?: string };
        error.code = "PRODUCT_VARIANT_LINKED_TO_OFFERS";
        throw error;
      }
      const linkedCollectionRows = await tx.select({ id: collectionItems.id }).from(collectionItems)
        .where(inArray(collectionItems.variantId, removedVariantIds)).limit(1);
      if (linkedCollectionRows.length > 0) {
        const error = new Error("linked-to-bundles") as Error & { code?: string };
        error.code = "PRODUCT_VARIANT_LINKED_TO_BUNDLES";
        throw error;
      }
      const soldRows = await tx.select({ variantId: orderItems.variantId }).from(orderItems)
        .where(inArray(orderItems.variantId, removedVariantIds));
      const soldIds = new Set(soldRows.map((row) => row.variantId).filter((id): id is number => id != null));
      const hardDeleteIds = removedVariantIds.filter((id) => !soldIds.has(id));
      if (soldIds.size > 0) {
        await tx.update(productVariants).set({ deletedAt: sql`NOW()` })
          .where(inArray(productVariants.id, [...soldIds]));
      }
      if (hardDeleteIds.length > 0) {
        await tx.delete(productVariants).where(inArray(productVariants.id, hardDeleteIds));
      }
    }

    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index]!;
      const sizeId = sizeIds.get(variant.sizeId);
      const colorId = variant.colorId == null ? null : colorIds.get(variant.colorId);
      if (!sizeId || (variant.colorId != null && !colorId)) {
        throw new Error("Variant references an unknown product option");
      }
      const values = {
        sizeId,
        colorId,
        sellingPrice: sql`${variant.sellingPrice}`,
        stockQty: variant.stockQty,
        sortOrder: index + 1,
        deletedAt: null
      };
      if (variant.id != null && existingVariantIds.has(variant.id)) {
        await tx.update(productVariants).set(values)
          .where(and(eq(productVariants.id, variant.id), eq(productVariants.productId, productId)));
      } else {
        await tx.insert(productVariants).values({ productId, ...values });
      }
    }

    const retainedSizeIds = new Set([...sizeIds.values()]);
    const removedSizeIds = existingSizes.map((row) => row.id).filter((id) => !retainedSizeIds.has(id));
    if (removedSizeIds.length > 0) {
      await tx.update(productSizes).set({ deletedAt: sql`NOW()` }).where(inArray(productSizes.id, removedSizeIds));
    }
    const retainedColorIds = new Set([...colorIds.values()]);
    const removedColorIds = existingColors.map((row) => row.id).filter((id) => !retainedColorIds.has(id));
    if (removedColorIds.length > 0) {
      await tx.update(productColors).set({ deletedAt: sql`NOW()` }).where(inArray(productColors.id, removedColorIds));
    }
  };

  if (executor) return run(executor);
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

export async function hardDeleteProductRepo(id: number): Promise<{ imagePath: string | null } | null> {
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
      .select({ imagePath: products.imagePath, deletedAt: products.deletedAt })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row || row.deletedAt == null) return null;

    await tx.delete(wishlists).where(eq(wishlists.productId, id));
    await tx.delete(productMedia).where(eq(productMedia.productId, id));
    await tx.delete(productVariants).where(eq(productVariants.productId, id));
    await tx.delete(products).where(eq(products.id, id));
    return { imagePath: row.imagePath ?? null };
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
