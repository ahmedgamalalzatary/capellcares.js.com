import { and, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { categories, products, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

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

  return db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      arName: products.arName,
      enName: products.enName,
      imagePath: products.imagePath,
      status: products.status,
      categorySlug: categories.slug,
      isNew: products.isNew,
      isBestseller: products.isBestseller
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...filters));
}

export async function findVisibleProductBySlug(slug: string) {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      sku: products.sku,
      arName: products.arName,
      enName: products.enName,
      imagePath: products.imagePath,
      status: products.status,
      categorySlug: categories.slug
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.status, "active"), isNull(products.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAdminProductsRepo() {
  return db.select().from(products).where(isNull(products.deletedAt));
}

export async function createAdminProductRepo(input: {
  sku: string;
  slug: string;
  arName: string;
  enName: string;
  buyingPrice: number;
  keywords: string;
  imagePath?: string | null;
  categoryId: number;
  status: "active" | "inactive";
  isNew?: boolean;
  isBestseller?: boolean;
}) {
  const [created] = await db.insert(products).values({
    ...input,
    buyingPrice: sql`${input.buyingPrice}`,
    imagePath: input.imagePath ?? null,
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
