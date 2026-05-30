import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { and, eq } from "drizzle-orm";
import {
  offerItems,
  offers,
  orderItems,
  orders,
  productVariants,
  products,
  wishlists
} from "../drizzle/schema.js";
import { db, mysqlPool } from "../src/db.js";
import { clearTestSeed, seedTestData } from "../src/seeds/test.seed.js";

const MISSING_ID = 999_999_999;
function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

type Baseline = {
  productId: number;
  variantId: number;
  secondVariantId: number;
  offerId: number;
};

async function loadBaseline(): Promise<Baseline> {
  const [firstProduct] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, "TEST-SKU-001"))
    .limit(1);
  const [secondProduct] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, "TEST-SKU-002"))
    .limit(1);
  const [offer] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(eq(offers.slug, "test-offer-baseline"))
    .limit(1);

  assert.ok(firstProduct && secondProduct && offer, "baseline seed incomplete");

  const [firstVariant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, firstProduct.id))
    .limit(1);
  const [secondVariant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, secondProduct.id))
    .limit(1);

  assert.ok(firstVariant && secondVariant, "baseline variants missing");

  return {
    productId: firstProduct.id,
    variantId: firstVariant.id,
    secondVariantId: secondVariant.id,
    offerId: offer.id
  };
}

async function createOrder(): Promise<number> {
  const [created] = await db
    .insert(orders)
    .values({
      orderCode: `INTEG-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      customerType: "guest",
      fullName: "Integrity Test",
      phone: "0100000000",
      email: "integrity@test.local",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "1 Test St",
      buildingApartment: "1",
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: "10.00"
    })
    .$returningId();
  return created.id;
}

let base: Baseline;

beforeEach(async () => {
  await clearTestSeed();
  await seedTestData();
  base = await loadBaseline();
});

afterEach(async () => {
  // Remove anything a test may have inserted, tolerating either pre- or
  // post-constraint behavior.
  await db.delete(orderItems).where(eq(orderItems.snapshotNameEn, "integrity-marker")).catch(() => {});
  await db.delete(orders).where(eq(orders.email, "integrity@test.local")).catch(() => {});
  await db.delete(wishlists).where(eq(wishlists.productId, base?.productId ?? MISSING_ID)).catch(() => {});
});

serialTest("rejects offer_items with a non-existent variant_id", async () => {
  await assert.rejects(
    db.insert(offerItems).values({ offerId: base.offerId, variantId: MISSING_ID, qty: 1 })
  );
});

serialTest("rejects offer_items with a non-existent offer_id", async () => {
  await assert.rejects(
    db.insert(offerItems).values({ offerId: MISSING_ID, variantId: base.variantId, qty: 1 })
  );
});

serialTest("rejects order_items with a non-existent variant_id", async () => {
  const orderId = await createOrder();
  await assert.rejects(
    db.insert(orderItems).values({
      orderId,
      itemType: "product_variant",
      variantId: MISSING_ID,
      qty: 1,
      unitPrice: "10.00",
      lineTotal: "10.00",
      snapshotNameEn: "integrity-marker"
    })
  );
});

serialTest("rejects a duplicate wishlists (customer_id, product_id)", async () => {
  // customer_id has no FK in scope; use a fixed synthetic id.
  const customerId = 4242;
  await db.insert(wishlists).values({ customerId, productId: base.productId });
  await assert.rejects(
    db.insert(wishlists).values({ customerId, productId: base.productId })
  );
});

serialTest("rejects a duplicate offer_items (offer_id, variant_id)", async () => {
  // Baseline already seeds one (offerId, variantId) row; a second must be rejected.
  await assert.rejects(
    db.insert(offerItems).values({ offerId: base.offerId, variantId: base.variantId, qty: 1 })
  );
});

serialTest("rejects a duplicate product_variants (product_id, size_label)", async () => {
  const [existing] = await db
    .select({ sizeLabel: productVariants.sizeLabel })
    .from(productVariants)
    .where(eq(productVariants.id, base.variantId))
    .limit(1);
  await assert.rejects(
    db.insert(productVariants).values({
      productId: base.productId,
      sizeLabel: existing!.sizeLabel,
      sellingPrice: "9.99",
      stockQty: 1
    })
  );
});

serialTest("deleting an offer cascades its offer_items", async () => {
  const [offer] = await db
    .insert(offers)
    .values({
      slug: `integ-cascade-${Date.now()}`,
      arName: "x",
      enName: "x",
      fixedPrice: "10.00"
    })
    .$returningId();
  await db.insert(offerItems).values({ offerId: offer.id, variantId: base.variantId, qty: 1 });

  await db.delete(offers).where(eq(offers.id, offer.id));

  const remaining = await db.select().from(offerItems).where(eq(offerItems.offerId, offer.id));
  assert.equal(remaining.length, 0);
});

serialTest("blocks deleting a product_variant referenced by an offer_item (RESTRICT)", async () => {
  // Baseline seeds an offer_item for base.variantId.
  await assert.rejects(
    db.delete(productVariants).where(eq(productVariants.id, base.variantId))
  );
});

serialTest("blocks deleting a product_variant referenced by an order_item (RESTRICT)", async () => {
  const orderId = await createOrder();
  await db.insert(orderItems).values({
    orderId,
    itemType: "product_variant",
    variantId: base.secondVariantId,
    qty: 1,
    unitPrice: "10.00",
    lineTotal: "10.00",
    snapshotNameEn: "integrity-marker"
  });

  await assert.rejects(
    db.delete(productVariants).where(eq(productVariants.id, base.secondVariantId))
  );
});

serialTest("supports soft-deleting a product_variant via deleted_at", async () => {
  await db
    .update(productVariants)
    .set({ deletedAt: new Date() } as any)
    .where(eq(productVariants.id, base.variantId));

  const [row] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, base.variantId)))
    .limit(1);
  assert.ok((row as any).deletedAt, "deleted_at should be set");

  // restore
  await db
    .update(productVariants)
    .set({ deletedAt: null } as any)
    .where(eq(productVariants.id, base.variantId));
});

serialTest("allows a new active variant with the same size after the old one is soft-deleted", async () => {
  const [existing] = await db
    .select({ sizeLabel: productVariants.sizeLabel })
    .from(productVariants)
    .where(eq(productVariants.id, base.variantId))
    .limit(1);

  await db
    .update(productVariants)
    .set({ deletedAt: new Date() } as any)
    .where(eq(productVariants.id, base.variantId));

  const [created] = await db
    .insert(productVariants)
    .values({
      productId: base.productId,
      sizeLabel: existing!.sizeLabel,
      sellingPrice: "12.50",
      stockQty: 3
    })
    .$returningId();
  assert.ok(created.id, "new same-size active variant should be allowed");

  await db.delete(productVariants).where(eq(productVariants.id, created.id));
  await db
    .update(productVariants)
    .set({ deletedAt: null } as any)
    .where(eq(productVariants.id, base.variantId));
});

test.after(async () => {
  await mysqlPool.end();
});
