import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { categories, categoryPaths, products, productVariants } from "@minikoshk/database/drizzle/schema";
import { db } from "@minikoshk/database/src/db";
import {
  loadMediaRows,
  loadProductOptions,
  mapVariant,
  normalizeMedia,
  resolveHoverImagePath,
  resolvePrimaryImagePath,
  toKeywords
} from "./shared.js";

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function findVisibleProducts(params: { lang: "ar" | "en"; q?: string; category?: string; limit?: number }) {
  const filters = [
    eq(products.status, "active"),
    isNull(products.deletedAt),
    isNull(categories.deletedAt)
  ];
  if (params.category) {
    const [root] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, params.category), isNull(categories.deletedAt)))
      .limit(1);
    if (!root) return [];
    const descendants = await db
      .select({ id: categoryPaths.descendantId })
      .from(categoryPaths)
      .innerJoin(categories, eq(categoryPaths.descendantId, categories.id))
      .where(and(eq(categoryPaths.ancestorId, root.id), isNull(categories.deletedAt)));
    filters.push(inArray(products.categoryId, descendants.map((row) => row.id)));
  }
  if (params.q?.trim()) {
    const q = params.q.trim();
    const pattern = `%${escapeLikeTerm(q)}%`;
    filters.push(
      or(
        // MySQL's default LIKE escape character is backslash, matching escapeLikeTerm.
        sql`${products.arName} LIKE ${pattern}`,
        sql`${products.enName} LIKE ${pattern}`,
        sql`${products.sku} LIKE ${pattern}`,
        sql`${products.keywords} LIKE ${pattern}`,
        sql`${products.arDescription} LIKE ${pattern}`,
        sql`${products.enDescription} LIKE ${pattern}`,
        sql`${products.arIngredients} LIKE ${pattern}`,
        sql`${products.enIngredients} LIKE ${pattern}`,
        sql`${products.arHowToUse} LIKE ${pattern}`,
        sql`${products.enHowToUse} LIKE ${pattern}`,
        sql`${products.arWarnings} LIKE ${pattern}`,
        sql`${products.enWarnings} LIKE ${pattern}`
      )!
    );
  }

  let productQuery = db
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
    .where(and(...filters))
    .$dynamic();
  if (params.limit != null) {
    productQuery = productQuery.orderBy(asc(products.id)).limit(params.limit);
  }
  const rows = await productQuery;

  if (rows.length === 0) return [];
  const productIds = rows.map((r) => r.id);
  const mediaByProduct = await loadMediaRows(productIds);
  const { sizesByProduct, colorsByProduct } = await loadProductOptions(productIds);
  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeId: productVariants.sizeId,
      colorId: productVariants.colorId,
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
      sizes: sizesByProduct.get(r.id) ?? [],
      colors: colorsByProduct.get(r.id) ?? [],
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
    .where(and(
      eq(products.slug, slug),
      eq(products.status, "active"),
      isNull(products.deletedAt),
      isNull(categories.deletedAt)
    ))
    .limit(1);
  const product = rows[0];
  if (!product) return null;
  const mediaByProduct = await loadMediaRows([product.id]);
  const { sizesByProduct, colorsByProduct } = await loadProductOptions([product.id]);

  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeId: productVariants.sizeId,
      colorId: productVariants.colorId,
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
    sizes: sizesByProduct.get(product.id) ?? [],
    colors: colorsByProduct.get(product.id) ?? [],
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
  const { sizesByProduct, colorsByProduct } = await loadProductOptions(rows.map((r) => r.id));

  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeId: productVariants.sizeId,
      colorId: productVariants.colorId,
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
      sizes: sizesByProduct.get(r.id) ?? [],
      colors: colorsByProduct.get(r.id) ?? [],
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
  const { sizesByProduct, colorsByProduct } = await loadProductOptions([row.id]);
  const variantsRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      sizeId: productVariants.sizeId,
      colorId: productVariants.colorId,
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
    sizes: sizesByProduct.get(row.id) ?? [],
    colors: colorsByProduct.get(row.id) ?? [],
    variants: variantsRows.map(mapVariant).sort((a, b) => a.sortOrder - b.sortOrder)
  };
}
