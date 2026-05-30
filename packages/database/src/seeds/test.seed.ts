import { eq, inArray, notInArray } from "drizzle-orm";
import {
  categories,
  customers,
  offerItems,
  offers,
  orderItems,
  orders,
  productMedia,
  productVariants,
  products
} from "../../drizzle/schema.js";
import { db } from "../db.js";

const seedSkus = ["TEST-SKU-001", "TEST-SKU-002"];
const seedOfferSlug = "test-offer-baseline";
const seedCustomerEmail = "seed-customer@capella.test";
const rootCategorySlug = "body-care";
const leafCategorySlug = "body-lotion";

export async function clearTestSeed() {
  if (process.env.NODE_ENV !== "test" && process.env.ALLOW_DB_WIPE !== "true") {
    throw new Error("clearTestSeed may only run in tests or when ALLOW_DB_WIPE=true.");
  }

  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(offerItems);
  await db.delete(productMedia);
  await db.delete(productVariants);
  await db.delete(offers);
  await db.delete(products);
  await db.delete(customers);

  for (;;) {
    const childRows = await db.select({ parentId: categories.parentId }).from(categories);
    const parentIds = childRows
      .map((row) => row.parentId)
      .filter((parentId): parentId is number => parentId !== null);

    const leafRows = parentIds.length
      ? await db
          .select({ id: categories.id })
          .from(categories)
          .where(notInArray(categories.id, parentIds))
      : await db.select({ id: categories.id }).from(categories);

    if (leafRows.length === 0) {
      break;
    }

    await db.delete(categories).where(
      inArray(
        categories.id,
        leafRows.map((row) => row.id)
      )
    );
  }
}

export async function seedTestData() {
  const rootCategory = await ensureCategory({
    slug: rootCategorySlug,
    arName: "العناية بالجسم",
    enName: "Body Care",
    isLeaf: false
  });
  const leafCategory = await ensureCategory({
    slug: leafCategorySlug,
    arName: "لوشن الجسم",
    enName: "Body Lotion",
    isLeaf: true,
    parentId: rootCategory.id
  });

  const firstProductId = await ensureProduct({
    sku: seedSkus[0],
    slug: "test-product-baseline-1",
    arName: "منتج تجريبي 1",
    enName: "Baseline Product 1",
    categoryId: leafCategory.id,
    buyingPrice: "20.00"
  });
  const secondProductId = await ensureProduct({
    sku: seedSkus[1],
    slug: "test-product-baseline-2",
    arName: "منتج تجريبي 2",
    enName: "Baseline Product 2",
    categoryId: leafCategory.id,
    buyingPrice: "15.00"
  });

  await ensureProductImageMedia(firstProductId, "/uploads/test-baseline.png");
  await ensureProductImageMedia(secondProductId, "/uploads/test-baseline.png");

  const firstVariantId = await ensureVariant({
    productId: firstProductId,
    sizeLabel: "100ml",
    sellingPrice: "35.00",
    stockQty: 10,
    sortOrder: 0
  });
  const secondVariantId = await ensureVariant({
    productId: secondProductId,
    sizeLabel: "200ml",
    sellingPrice: "55.00",
    stockQty: 6,
    sortOrder: 0
  });

  const offerId = await ensureOffer({
    slug: seedOfferSlug,
    arName: "عرض تجريبي",
    enName: "Baseline Offer",
    fixedPrice: "70.00"
  });

  await ensureOfferItem({ offerId, variantId: firstVariantId, qty: 1 });
  await ensureOfferItem({ offerId, variantId: secondVariantId, qty: 1 });
  await ensureCustomer({
    name: "Seed Customer",
    email: seedCustomerEmail,
    passwordHash: "$2a$10$0V6QY0bL5Qn5hEw5N1iXROXGdPvxI6Bjq5lHppZArYrusS4x2QVFG"
  });
}

async function ensureCategory(input: {
  slug: string;
  arName: string;
  enName: string;
  isLeaf: boolean;
  parentId?: number;
}) {
  const [existing] = await db.select().from(categories).where(eq(categories.slug, input.slug)).limit(1);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(categories)
    .values(input)
    .$returningId()
    .catch(async (error: any) => {
      if (error?.code === "ER_DUP_ENTRY") {
        const [row] = await db.select().from(categories).where(eq(categories.slug, input.slug)).limit(1);
        if (row) return [{ id: row.id }];
      }
      throw error;
    });

  const [category] = await db.select().from(categories).where(eq(categories.id, created.id)).limit(1);
  return category!;
}

async function ensureProduct(input: {
  sku: string;
  slug: string;
  arName: string;
  enName: string;
  categoryId: number;
  buyingPrice: string;
}) {
  const [existing] = await db.select().from(products).where(eq(products.sku, input.sku)).limit(1);
  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(products)
    .values({
      ...input,
      keywords: "test,baseline",
      imagePath: "/uploads/test-baseline.png",
      status: "active",
      isNew: false,
      isBestseller: false
    })
    .$returningId()
    .catch(async (error: any) => {
      if (error?.code === "ER_DUP_ENTRY") {
        const [row] = await db.select().from(products).where(eq(products.sku, input.sku)).limit(1);
        if (row) return [{ id: row.id }];
      }
      throw error;
    });

  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.sku, input.sku)).limit(1);
  return product?.id ?? created.id;
}

async function ensureVariant(input: {
  productId: number;
  sizeLabel: string;
  sellingPrice: string;
  stockQty: number;
  sortOrder: number;
}) {
  const [existing] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, input.productId))
    .limit(1);
  if (existing) {
    return existing.id;
  }

  const [created] = await db.insert(productVariants).values(input).$returningId();
  return created.id;
}

async function ensureProductImageMedia(productId: number, url: string) {
  const [existing] = await db
    .select()
    .from(productMedia)
    .where(eq(productMedia.productId, productId))
    .limit(1);
  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(productMedia)
    .values({
      productId,
      mediaType: "image",
      url,
      sortOrder: 1
    })
    .$returningId();

  return created.id;
}

async function ensureOffer(input: {
  slug: string;
  arName: string;
  enName: string;
  fixedPrice: string;
}) {
  const [existing] = await db.select().from(offers).where(eq(offers.slug, input.slug)).limit(1);
  if (existing) {
    return existing.id;
  }

  const [created] = await db
    .insert(offers)
    .values({
      ...input,
      status: "active",
      visibility: "visible",
      imagePath: "/uploads/test-offer.png"
    })
    .$returningId()
    .catch(async (error: any) => {
      if (error?.code === "ER_DUP_ENTRY") {
        const [row] = await db.select().from(offers).where(eq(offers.slug, input.slug)).limit(1);
        if (row) return [{ id: row.id }];
      }
      throw error;
    });

  return created.id;
}

async function ensureOfferItem(input: { offerId: number; variantId: number; qty: number }) {
  const [existing] = await db
    .select()
    .from(offerItems)
    .where(
      eq(offerItems.offerId, input.offerId)
    )
    .limit(1);
  if (existing?.variantId === input.variantId) {
    return existing.id;
  }

  const [created] = await db.insert(offerItems).values(input).$returningId();
  return created.id;
}

async function ensureCustomer(input: { name: string; email: string; passwordHash: string }) {
  const [existing] = await db.select().from(customers).where(eq(customers.email, input.email)).limit(1);
  if (existing) {
    return existing.id;
  }

  const [created] = await db.insert(customers).values(input).$returningId();
  return created.id;
}
