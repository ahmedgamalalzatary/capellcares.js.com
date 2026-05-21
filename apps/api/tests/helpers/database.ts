import { eq, inArray } from "drizzle-orm";
import {
  categories,
  adminUsers,
  authSessions,
  customers,
  advices,
  offerItems,
  offers,
  orderItems,
  orders,
  productVariants,
  products,
  wishlists
} from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { clearTestSeed, seedTestData } from "@capella/database/src/seeds/test.seed";

export async function resetApiTestDatabase() {
  await db.delete(authSessions);
  await db.delete(adminUsers);
  await db.delete(wishlists);
  await db.delete(orderItems);
  await db.delete(orders);
  await db.delete(advices);
  await clearTransientProducts();
  await db.delete(categories).where(inArray(categories.slug, ["route-parent-cat", "route-child-cat"]));
  await clearTestSeed();
  await seedTestData();
}

export async function createTestCustomer(input: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const [created] = await db.insert(customers).values(input).$returningId();
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

async function clearTransientProducts() {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(inArray(products.sku, [
      "ROUTE-ACTIVE-001",
      "ERP-SKU-TEST-001",
      "ERP-SKU-TEST-002",
      "ROUTE-NO-VARIANTS",
      "ROUTE-NO-KEYWORDS",
      "ROUTE-NO-IMAGE",
      "ROUTE-NO-EN",
      "ROUTE-NO-AR",
      "ROUTE-INACTIVE-INCOMPLETE",
      "ROUTE-ACTIVE-COMPLETE"
    ]));

  const serviceRows = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, "service-test-product"));

  const rowsWithService = [...rows, ...serviceRows.filter((serviceRow) => !rows.some((row) => row.id === serviceRow.id))];

  if (rowsWithService.length === 0) {
    return;
  }

  const productIds = rowsWithService.map((row) => row.id);
  const variantRows = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds));

  const variantIds = variantRows.map((row) => row.id);
  if (variantIds.length > 0) {
    await db.delete(offerItems).where(inArray(offerItems.variantId, variantIds));
  }
  await db.delete(productVariants).where(inArray(productVariants.productId, productIds));
  await db.delete(products).where(inArray(products.id, productIds));
}
