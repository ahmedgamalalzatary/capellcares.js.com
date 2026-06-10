import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { categories, products, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import {
  loadMediaRows,
  mapVariant,
  normalizeMedia,
  resolveHoverImagePath,
  resolvePrimaryImagePath,
  toKeywords
} from "./shared.js";

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function findVisibleProducts(params: { lang: "ar" | "en"; q?: string; category?: string }) {
  const filters = [eq(products.status, "active"), isNull(products.deletedAt)];
  if (params.category) {
    const allCategories = await db.select({ id: categories.id, parentId: categories.parentId, slug: categories.slug }).from(categories).where(isNull(categories.deletedAt));
    const root = allCategories.find((c) => c.slug === params.category);
    if (!root) return [];
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
      isBestseller: products.isBestseller
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...filters));

  if (rows.length === 0) return [];
  const productIds = rows.map((r) => r.id);
  const mediaByProduct = await loadMediaRows(productIds);
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
    list.push(mapVariant(v));
    variantsByProduct.set(v.productId, list);
  }

  return rows.map((r) => {
    const media = normalizeMedia(mediaByProduct.get(r.id), r.imagePath);
    return {
      ...r,
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
    };
  });
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
    variants: variantsRows.map(mapVariant).sort((a, b) => a.sortOrder - b.sortOrder),
    name: { ar: product.arName, en: product.enName },
    description: { ar: product.arDescription ?? "", en: product.enDescription ?? "" },
    ingredients: { ar: product.arIngredients ?? "", en: product.enIngredients ?? "" },
    howToUse: { ar: product.arHowToUse ?? "", en: product.enHowToUse ?? "" },
    warnings: { ar: product.arWarnings ?? "", en: product.enWarnings ?? "" }
  };
}

export async function listAdminProductsRepo() {
  const rows = await db.select().from(products);
  if (rows.length === 0) return [];
  const mediaByProduct = await loadMediaRows(rows.map((r) => r.id));

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
    list.push(mapVariant(v));
    variantsByProduct.set(v.productId, list);
  }

  return rows.map((r) => {
    const media = normalizeMedia(mediaByProduct.get(r.id), r.imagePath);
    return {
      ...r,
      imagePath: resolvePrimaryImagePath(media, r.imagePath),
      hoverImagePath: resolveHoverImagePath(r.hoverImagePath) ?? "",
      media,
      variants: (variantsByProduct.get(r.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
    };
  });
}

export async function findAdminProductByIdRepo(id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) {
    return null;
  }

  const mediaByProduct = await loadMediaRows([row.id]);
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
    variants: variantsRows.map(mapVariant).sort((a, b) => a.sortOrder - b.sortOrder)
  };
}
