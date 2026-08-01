import { eq, inArray } from "drizzle-orm";
import {
  categories,
  adminUserPermissions,
  adminUsers,
  authSessions,
  collections,
  customers,
  permissions,
  advices,
  offers,
  productVariants,
  products,
  relatedItems,
  reviewPromptStates,
  reviewSubmissionHistory,
  reviews,
  shopMediaSectionItems,
  shopMediaSections,
  wishlists
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { clearTestSeed, seedTestData } from "@capella/database/src/seeds/test.seed";

export async function resetApiTestDatabase() {
  await db.delete(reviewPromptStates);
  await db.delete(reviewSubmissionHistory);
  await db.delete(reviews);
  await db.delete(relatedItems);
  await db.delete(authSessions);
  await db.delete(wishlists);
  await db.delete(advices);
  await db.delete(adminUserPermissions);
  await db.delete(adminUsers);
  await db.delete(permissions);
  await db.delete(shopMediaSectionItems);
  await db.delete(shopMediaSections);
  await clearTestSeed();
  await seedTestData();
}

export async function createTestAdminUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role?: "admin" | "staff";
  isActive?: boolean;
}) {
  const [created] = await db.insert(adminUsers).values({
    role: "staff",
    isActive: true,
    ...input
  }).$returningId();
  return created.id;
}

export async function deleteCustomerByEmail(email: string) {
  await db.delete(wishlists).where(
    inArray(
      wishlists.customerId,
      (
        await db.select({ id: customers.id }).from(customers).where(eq(customers.email, email))
      ).map((customer) => customer.id)
    )
  );
  await db.delete(customers).where(eq(customers.email, email));
}

export async function getBaselineIds() {
  const [productOne, productTwo, offer, collection, customer] = await Promise.all([
    db.select({ id: products.id, categoryId: products.categoryId }).from(products).where(eq(products.sku, "TEST-SKU-001")).then((rows) => rows[0]),
    db.select({ id: products.id, categoryId: products.categoryId }).from(products).where(eq(products.sku, "TEST-SKU-002")).then((rows) => rows[0]),
    db.select({ id: offers.id }).from(offers).where(eq(offers.slug, "test-offer-baseline")).then((rows) => rows[0]),
    db.select({ id: collections.id }).from(collections).where(eq(collections.slug, "test-collection-baseline")).then((rows) => rows[0]),
    db.select({ id: customers.id }).from(customers).where(eq(customers.email, "seed-customer@capella.test")).then((rows) => rows[0])
  ]);

  if (!productOne || !productTwo || !offer || !collection || !customer) {
    throw new Error("Baseline test seed is incomplete");
  }

  const [leafCategory] = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.id, productOne.categoryId))
    .limit(1);

  if (!leafCategory) {
    throw new Error("Baseline leaf category is missing");
  }

  let rootCategory: { id: number; parentId: number | null } | undefined = leafCategory;

  while (rootCategory?.parentId != null) {
    rootCategory = await db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, rootCategory.parentId))
      .then((rows) => rows[0]);
  }

  if (!rootCategory) {
    throw new Error("Baseline root category is missing");
  }

  const variants = await db
    .select({ id: productVariants.id, productId: productVariants.productId, stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(inArray(productVariants.productId, [productOne.id, productTwo.id]));

  const firstVariant = variants.find((variant) => variant.productId === productOne.id);
  const secondVariant = variants.find((variant) => variant.productId === productTwo.id);

  if (!firstVariant || !secondVariant) {
    throw new Error("Baseline test variants are missing");
  }

  return {
    productOneId: productOne.id,
    productTwoId: productTwo.id,
    offerId: offer.id,
    collectionId: collection.id,
    rootCategoryId: rootCategory.id,
    leafCategoryId: leafCategory.id,
    customerId: customer.id,
    firstVariantId: firstVariant.id,
    secondVariantId: secondVariant.id
  };
}
