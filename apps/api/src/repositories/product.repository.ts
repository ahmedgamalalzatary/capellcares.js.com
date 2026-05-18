import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { categories, products, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function toKeywords(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapVariant(v: {
  id: number;
  productId: number;
  sizeLabel: string;
  sellingPrice: unknown;
  stockQty: number;
  sortOrder: number;
}) {
  return {
    id: v.id,
    productId: v.productId,
    size: v.sizeLabel,
    price: toNumber(v.sellingPrice),
    stock: v.stockQty,
    sortOrder: v.sortOrder
  };
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
    const hasArabic = /[\u0600-\u06FF]/.test(q);
    filters.push(
      or(
        like(hasArabic ? products.arName : products.enName, `%${q}%`),
        like(products.keywords, `%${q}%`)
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
      buyingPrice: products.buyingPrice,
      imagePath: products.imagePath,
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
    .where(inArray(productVariants.productId, productIds));

  const variantsByProduct = new Map<number, ReturnType<typeof mapVariant>[]>();
  for (const v of variantsRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(mapVariant(v));
    variantsByProduct.set(v.productId, list);
  }

  return rows.map((r) => ({
    ...r,
    keywords: toKeywords(r.keywords),
    buyingPrice: toNumber(r.buyingPrice),
    variants: (variantsByProduct.get(r.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
    name: { ar: r.arName, en: r.enName },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" }
  }));
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
      buyingPrice: products.buyingPrice,
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
    .where(eq(productVariants.productId, product.id));

  return {
    ...product,
    keywords: toKeywords(product.keywords),
    buyingPrice: toNumber(product.buyingPrice),
    variants: variantsRows.map(mapVariant).sort((a, b) => a.sortOrder - b.sortOrder),
    name: { ar: product.arName, en: product.enName },
    description: { ar: product.arDescription ?? "", en: product.enDescription ?? "" },
    ingredients: { ar: product.arIngredients ?? "", en: product.enIngredients ?? "" },
    howToUse: { ar: product.arHowToUse ?? "", en: product.enHowToUse ?? "" },
    warnings: { ar: product.arWarnings ?? "", en: product.enWarnings ?? "" }
  };
}

export async function listAdminProductsRepo() {
  const rows = await db.select().from(products).where(isNull(products.deletedAt));
  if (rows.length === 0) return [];

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
    .where(inArray(productVariants.productId, rows.map((r) => r.id)));

  const variantsByProduct = new Map<number, ReturnType<typeof mapVariant>[]>();
  for (const v of variantsRows) {
    const list = variantsByProduct.get(v.productId) ?? [];
    list.push(mapVariant(v));
    variantsByProduct.set(v.productId, list);
  }

  return rows.map((r) => ({
    ...r,
    variants: (variantsByProduct.get(r.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
  }));
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
  categoryId: number;
  status: "active" | "inactive";
  isNew?: boolean;
  isBestseller?: boolean;
}) {
  if (input.id) {
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, input.id))
      .limit(1);

    if (existing) {
      await db
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
          imagePath: input.imagePath ?? null,
          categoryId: input.categoryId,
          status: input.status,
          isNew: input.isNew ?? false,
          isBestseller: input.isBestseller ?? false
        })
        .where(eq(products.id, input.id));
      return { id: input.id };
    }
  }

  const [created] = await db.insert(products).values({
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
    imagePath: input.imagePath ?? null,
    categoryId: input.categoryId,
    status: input.status,
    isNew: input.isNew ?? false,
    isBestseller: input.isBestseller ?? false
  }).$returningId();
  return created;
}

export async function addVariantRepo(input: {
  productId: number;
  sizeLabel: string;
  sellingPrice: number;
  stockQty: number;
}) {
  await db.insert(productVariants).values({
    productId: input.productId,
    sizeLabel: input.sizeLabel,
    sellingPrice: sql`${input.sellingPrice}`,
    stockQty: input.stockQty
  });
}

export async function replaceVariantsRepo(
  productId: number,
  variants: Array<{ sizeLabel: string; sellingPrice: number; stockQty: number }>
) {
  await db.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length === 0) return;
  await db.insert(productVariants).values(
    variants.map((v, index) => ({
      productId,
      sizeLabel: v.sizeLabel,
      sellingPrice: sql`${v.sellingPrice}`,
      stockQty: v.stockQty,
      sortOrder: index + 1
    }))
  );
}

export async function softDeleteProductRepo(id: number) {
  await db.update(products).set({ deletedAt: sql`NOW()` }).where(eq(products.id, id));
}

export async function restoreProductRepo(id: number) {
  await db.update(products).set({ deletedAt: null }).where(eq(products.id, id));
}

export async function toggleProductStatusRepo(id: number) {
  const [current] = await db.select({ status: products.status }).from(products).where(eq(products.id, id)).limit(1);
  if (!current) return;
  await db
    .update(products)
    .set({ status: current.status === "active" ? "inactive" : "active" })
    .where(eq(products.id, id));
}

export async function setVariantStockRepo(variantId: number, stockQty: number) {
  await db.update(productVariants).set({ stockQty }).where(eq(productVariants.id, variantId));
}
