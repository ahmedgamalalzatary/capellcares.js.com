import { and, eq, isNull, like, sql } from "drizzle-orm";
import { categories, products, productVariants } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";

export async function findVisibleProducts(params: { lang: "ar" | "en"; q?: string; category?: string }) {
  const nameColumn = params.lang === "en" ? products.enName : products.arName;
  const filters = [eq(products.status, "active"), isNull(products.deletedAt)];
  if (params.category) filters.push(eq(categories.slug, params.category));
  if (params.q?.trim()) filters.push(like(nameColumn, `%${params.q.trim()}%`));

  return db
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
}) {
  const [created] = await db.insert(products).values({
    ...input,
    buyingPrice: sql`${input.buyingPrice}`,
    imagePath: input.imagePath ?? null
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
