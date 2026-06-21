import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { compareByScopedOrdering } from "@capella/shared";
import { categories, offerItems, offers, products, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { findSingleVariantActiveOfferPriceByVariantId } from "../../modules/offers/effective-offer-pricing.js";
import { loadProductOrderingRowsRepo, rankForProductScope } from "./ordering.js";
import {
  loadMediaRows,
  mapVariant,
  normalizeMedia,
  resolveHoverImagePath,
  resolvePrimaryImagePath,
  toKeywords
} from "./shared.js";

type VariantRow = {
  id: number;
  productId: number;
  sizeLabel: string;
  sellingPrice: unknown;
  stockQty: number;
  sortOrder: number;
};

async function loadActiveOfferData(productIds: number[]) {
  if (productIds.length === 0) {
    return {
      offerIdsByProductId: new Map<number, number[]>(),
      effectiveOfferPriceByVariantId: new Map<number, number>()
    };
  }

  const rows = await db
    .select({
      offerId: offers.id,
      status: offers.status,
      fixedPrice: offers.fixedPrice,
      variantId: offerItems.variantId,
      qty: offerItems.qty,
      productId: productVariants.productId
    })
    .from(offerItems)
    .innerJoin(offers, eq(offerItems.offerId, offers.id))
    .innerJoin(productVariants, eq(offerItems.variantId, productVariants.id))
    .where(
      and(
        inArray(productVariants.productId, productIds),
        eq(offers.status, "active"),
        eq(offers.visibility, "visible"),
        isNull(offers.deletedAt),
        isNull(productVariants.deletedAt)
      )
    );

  const offerIdsByProductId = new Map<number, Set<number>>();

  for (const row of rows) {
    const productOfferIds = offerIdsByProductId.get(row.productId) ?? new Set<number>();
    productOfferIds.add(row.offerId);
    offerIdsByProductId.set(row.productId, productOfferIds);
  }

  // The query above is scoped to the requested products (and excludes soft-deleted
  // variants), so its rows are NOT a reliable count of an offer's membership: a real
  // bundle can look like a single item once filtered. Re-load the candidate offers'
  // FULL item sets so single-variant detection sees each offer's true contents.
  const candidateOfferIds = [...new Set(rows.map((row) => row.offerId))];
  const offersById = new Map<number, { status: "active" | "inactive"; fixedPrice: unknown; items: Array<{ variantId: number; qty: number }> }>();

  if (candidateOfferIds.length > 0) {
    const fullItemRows = await db
      .select({
        offerId: offers.id,
        status: offers.status,
        fixedPrice: offers.fixedPrice,
        variantId: offerItems.variantId,
        qty: offerItems.qty
      })
      .from(offerItems)
      .innerJoin(offers, eq(offerItems.offerId, offers.id))
      .where(inArray(offerItems.offerId, candidateOfferIds));

    for (const row of fullItemRows) {
      const offer = offersById.get(row.offerId) ?? { status: row.status, fixedPrice: row.fixedPrice, items: [] };
      offer.items.push({ variantId: row.variantId, qty: row.qty });
      offersById.set(row.offerId, offer);
    }
  }

  return {
    offerIdsByProductId: new Map(
      [...offerIdsByProductId.entries()].map(([productId, offerIds]) => [productId, [...offerIds]])
    ),
    effectiveOfferPriceByVariantId: findSingleVariantActiveOfferPriceByVariantId(
      [...offersById.entries()].map(([id, offer]) => ({ id, ...offer }))
    )
  };
}

function mapEffectiveVariant(
  variant: VariantRow,
  effectiveOfferPriceByVariantId: Map<number, number>
) {
  return mapVariant({
    ...variant,
    sellingPrice: effectiveOfferPriceByVariantId.get(variant.id) ?? variant.sellingPrice
  });
}

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function findVisibleProducts(params: { lang: "ar" | "en"; q?: string; category?: string; categoryId?: string }) {
  const filters = [eq(products.status, "active"), isNull(products.deletedAt)];
  let scopeCategoryId: number | null = null;
  if (params.categoryId || params.category) {
    const allCategories = await db.select({ id: categories.id, parentId: categories.parentId, slug: categories.slug }).from(categories).where(isNull(categories.deletedAt));
    const requestedCategoryId = Number(params.categoryId);
    const root = Number.isInteger(requestedCategoryId) && requestedCategoryId > 0
      ? allCategories.find((c) => c.id === requestedCategoryId)
      : allCategories.find((c) => c.slug === params.category);
    if (!root) return [];
    scopeCategoryId = root.id;
    const descendantIds = new Set<number>([root.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of allCategories) {
        if (c.parentId != null && descendantIds.has(c.parentId) && !descendantIds.has(c.id)) {
          descendantIds.add(c.id);
          changed = true;
        }
      }
    }
    filters.push(inArray(products.categoryId, [...descendantIds]));
  }
  if (params.q?.trim()) {
    const q = params.q.trim();
    const pattern = `%${escapeLikeTerm(q)}%`;
    const hasArabic = /[\u0600-\u06FF]/.test(q);
    filters.push(
      or(
        // MySQL's default LIKE escape character is backslash, matching escapeLikeTerm.
        sql`${hasArabic ? products.arName : products.enName} LIKE ${pattern}`,
        sql`${products.keywords} LIKE ${pattern}`
      )!
    );
  }

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      arName: products.arName,
      enName: products.enName,
      keywords: products.keywords,
      imagePath: products.imagePath,
      hoverImagePath: products.hoverImagePath,
      status: products.status,
      categoryId: products.categoryId,
      deletedAt: products.deletedAt,
      categorySlug: categories.slug,
      isNew: products.isNew,
      isBestseller: products.isBestseller,
      createdAt: products.createdAt
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...filters));

  if (rows.length === 0) return [];
  const productIds = rows.map((r) => r.id);
  const orderingRows = await loadProductOrderingRowsRepo(productIds);
  const rankByProductId = rankForProductScope(orderingRows, scopeCategoryId);
  const mediaByProduct = await loadMediaRows(productIds);
  const { offerIdsByProductId, effectiveOfferPriceByVariantId } = await loadActiveOfferData(productIds);
  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty,
      sortOrder: productVariants.sortOrder
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, productIds), isNull(productVariants.deletedAt)));

  const variantsByProduct = new Map<number, ReturnType<typeof mapVariant>[]>();
  for (const v of variantsRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(mapEffectiveVariant(v, effectiveOfferPriceByVariantId));
    variantsByProduct.set(v.productId, list);
  }

  return rows
    .map((r) => {
      const media = normalizeMedia(mediaByProduct.get(r.id), r.imagePath);
      return {
        ...r,
        sortOrder: rankByProductId.get(r.id),
        imagePath: resolvePrimaryImagePath(media, r.imagePath),
        hoverImagePath: resolveHoverImagePath(r.hoverImagePath) ?? "",
        media,
        keywords: toKeywords(r.keywords),
        variants: (variantsByProduct.get(r.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
        name: { ar: r.arName, en: r.enName },
        description: { ar: "", en: "" },
        ingredients: { ar: "", en: "" },
        howToUse: { ar: "", en: "" },
        warnings: { ar: "", en: "" }
        ,
        offerIds: offerIdsByProductId.get(r.id) ?? []
      };
    })
    .sort(compareByScopedOrdering.bind(null, "storefront"));
}

export async function findVisibleProductBySlug(slug: string) {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      arName: products.arName,
      enName: products.enName,
      keywords: products.keywords,
      arDescription: products.arDescription,
      enDescription: products.enDescription,
      arIngredients: products.arIngredients,
      enIngredients: products.enIngredients,
      arHowToUse: products.arHowToUse,
      enHowToUse: products.enHowToUse,
      arWarnings: products.arWarnings,
      enWarnings: products.enWarnings,
      youtubeUrl: products.youtubeUrl,
      imagePath: products.imagePath,
      hoverImagePath: products.hoverImagePath,
      status: products.status,
      isNew: products.isNew,
      isBestseller: products.isBestseller,
      categoryId: products.categoryId,
      deletedAt: products.deletedAt,
      categorySlug: categories.slug
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active"), isNull(products.deletedAt)))
    .limit(1);
  const product = rows[0];
  if (!product) return null;
  const mediaByProduct = await loadMediaRows([product.id]);
  const { offerIdsByProductId, effectiveOfferPriceByVariantId } = await loadActiveOfferData([product.id]);

  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty,
      sortOrder: productVariants.sortOrder
    })
    .from(productVariants)
    .where(and(eq(productVariants.productId, product.id), isNull(productVariants.deletedAt)));

  const media = normalizeMedia(mediaByProduct.get(product.id), product.imagePath);
  return {
    ...product,
    imagePath: resolvePrimaryImagePath(media, product.imagePath),
    hoverImagePath: resolveHoverImagePath(product.hoverImagePath) ?? "",
    media,
    keywords: toKeywords(product.keywords),
    variants: variantsRows.map((variant) => mapEffectiveVariant(variant, effectiveOfferPriceByVariantId)).sort((a, b) => a.sortOrder - b.sortOrder),
    name: { ar: product.arName, en: product.enName },
    description: { ar: product.arDescription ?? "", en: product.enDescription ?? "" },
    ingredients: { ar: product.arIngredients ?? "", en: product.enIngredients ?? "" },
    howToUse: { ar: product.arHowToUse ?? "", en: product.enHowToUse ?? "" },
    warnings: { ar: product.arWarnings ?? "", en: product.enWarnings ?? "" },
    offerIds: offerIdsByProductId.get(product.id) ?? []
  };
}

export async function listAdminProductsRepo() {
  const rows = await db.select().from(products);
  if (rows.length === 0) return [];
  const orderingRows = await loadProductOrderingRowsRepo(rows.map((r) => r.id));
  const rootRankByProductId = rankForProductScope(orderingRows, null);
  const orderingsByProductId = new Map<number, Array<{ scopeType: string; scopeId: number | null; rank: number }>>();
  for (const row of orderingRows) {
    const list = orderingsByProductId.get(row.entityId) ?? [];
    list.push({ scopeType: row.scopeType, scopeId: row.scopeId, rank: row.rank });
    orderingsByProductId.set(row.entityId, list);
  }
  const mediaByProduct = await loadMediaRows(rows.map((r) => r.id));
  const { offerIdsByProductId, effectiveOfferPriceByVariantId } = await loadActiveOfferData(rows.map((r) => r.id));

  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty,
      sortOrder: productVariants.sortOrder
    })
    .from(productVariants)
    .where(and(inArray(productVariants.productId, rows.map((r) => r.id)), isNull(productVariants.deletedAt)));

  const variantsByProduct = new Map<number, ReturnType<typeof mapVariant>[]>();
  for (const v of variantsRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(mapEffectiveVariant(v, effectiveOfferPriceByVariantId));
    variantsByProduct.set(v.productId, list);
  }

  return rows
    .map((r) => {
      const media = normalizeMedia(mediaByProduct.get(r.id), r.imagePath);
      return {
        ...r,
        sortOrder: rootRankByProductId.get(r.id),
        orderings: orderingsByProductId.get(r.id) ?? [],
        imagePath: resolvePrimaryImagePath(media, r.imagePath),
        hoverImagePath: resolveHoverImagePath(r.hoverImagePath) ?? "",
        media,
        offerIds: offerIdsByProductId.get(r.id) ?? [],
        variants: (variantsByProduct.get(r.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      };
    })
    .sort(compareByScopedOrdering.bind(null, "erp"));
}

export async function findAdminProductByIdRepo(id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) {
    return null;
  }

  const mediaByProduct = await loadMediaRows([row.id]);
  const { offerIdsByProductId, effectiveOfferPriceByVariantId } = await loadActiveOfferData([row.id]);
  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeLabel: productVariants.sizeLabel,
      sellingPrice: productVariants.sellingPrice,
      stockQty: productVariants.stockQty,
      sortOrder: productVariants.sortOrder
    })
    .from(productVariants)
    .where(and(eq(productVariants.productId, row.id), isNull(productVariants.deletedAt)));

  const media = normalizeMedia(mediaByProduct.get(row.id), row.imagePath);
  return {
    ...row,
    imagePath: resolvePrimaryImagePath(media, row.imagePath),
    hoverImagePath: resolveHoverImagePath(row.hoverImagePath) ?? "",
    media,
    keywords: toKeywords(row.keywords),
    offerIds: offerIdsByProductId.get(row.id) ?? [],
    variants: variantsRows.map((variant) => mapEffectiveVariant(variant, effectiveOfferPriceByVariantId)).sort((a, b) => a.sortOrder - b.sortOrder)
  };
}
