import { eq, inArray } from "drizzle-orm";
import {
  categories,
  adminUserPermissions,
  adminUsers,
  authSessions,
  customers,
  permissions,
  advices,
  offers,
  productVariants,
  products,
  relatedItems,
  wishlists
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { clearTestSeed, seedTestData } from "@capella/database/src/seeds/test.seed";

export async function resetApiTestDatabase() {
  await db.delete(relatedItems);
  await db.delete(authSessions);
  await db.delete(wishlists);
  await db.delete(advices);
  await db.delete(adminUserPermissions);
  await db.delete(adminUsers);
  await db.delete(permissions);
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
  const [productOne, productTwo, offer, rootCategory, leafCategory, customer] = await Promise.all([
    db.select({ id: products.id }).from(products).where(eq(products.sku, "TEST-SKU-001")).then((rows) => rows[0]),
    db.select({ id: products.id }).from(products).where(eq(products.sku, "TEST-SKU-002")).then((rows) => rows[0]),
    db.select({ id: offers.id }).from(offers).where(eq(offers.slug, "test-offer-baseline")).then((rows) => rows[0]),
    db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "body-care")).then((rows) => rows[0]),
    db.select({ id: categories.id }).from(categories).where(eq(categories.slug, "body-lotion")).then((rows) => rows[0]),
    db.select({ id: customers.id }).from(customers).where(eq(customers.email, "seed-customer@capella.test")).then((rows) => rows[0])
  ]);

  if (!productOne || !productTwo || !offer || !rootCategory || !leafCategory || !customer) {
    throw new Error("Baseline test seed is incomplete");
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
    rootCategoryId: rootCategory.id,
    leafCategoryId: leafCategory.id,
    customerId: customer.id,
    firstVariantId: firstVariant.id,
    secondVariantId: secondVariant.id
  };
}
