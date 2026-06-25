import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq, inArray } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { collectionItems, collections, offerItems, offers, orderItems, orders, productVariants, products, variantDiscounts } from "@capella/database/drizzle/schema";
import { createOrderFromCheckout } from "../../src/modules/orders/orders.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

function baseCheckoutPayload() {
  return {
    fullName: "Checkout Guard",
    phone: "01012345678",
    email: "guard-checkout@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 9",
    buildingApartment: "Building 9",
    paymentMethod: "cod" as const
  };
}

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("createOrderFromCheckout deducts stock for normal product variants and keeps payment pending", async () => {
  const ids = await getBaselineIds();

  const result = await createOrderFromCheckout({
    fullName: "Checkout Variant",
    phone: "01012345678",
    email: "variant-checkout@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 1",
    buildingApartment: "Building 2",
    paymentMethod: "cod",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
  });

  const [variant] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId))
    .limit(1);
  const [order] = await db
    .select({ paymentStatus: orders.paymentStatus, orderCode: orders.orderCode })
    .from(orders)
    .where(eq(orders.id, result.id))
    .limit(1);
  const [createdOrderItem] = await db
    .select({ createdAt: orderItems.createdAt })
    .from(orderItems)
    .where(eq(orderItems.orderId, result.id))
    .limit(1);

  assert.equal(variant?.stockQty, 8);
  assert.equal(order?.paymentStatus, "pending");
  assert.match(order?.orderCode ?? "", /^[A-Z]{4}-\d{3,}$/);
  assert.ok(createdOrderItem?.createdAt, "expected order items to persist createdAt");
});

test("createOrderFromCheckout ignores a single-variant active offer price for a product line", async () => {
  const ids = await getBaselineIds();

  // A single-variant active offer on the first variant (normal price 35) at 25.
  const [createdOffer] = await db
    .insert(offers)
    .values({
      slug: `checkout-single-variant-${Date.now()}`,
      arName: "عرض متغير واحد",
      enName: "Single Variant Offer",
      imagePath: "/uploads/single-variant-offer.png",
      fixedPrice: "25.00",
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  await db.insert(offerItems).values({ offerId: createdOffer.id, variantId: ids.firstVariantId, qty: 1 });

  const result = await createOrderFromCheckout({
    ...baseCheckoutPayload(),
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
  });

  const [line] = await db
    .select({ unitPrice: orderItems.unitPrice, lineTotal: orderItems.lineTotal })
    .from(orderItems)
    .where(eq(orderItems.orderId, result.id))
    .limit(1);
  const [order] = await db
    .select({ totalAmount: orders.totalAmount })
    .from(orders)
    .where(eq(orders.id, result.id))
    .limit(1);

  assert.equal(Number(line?.unitPrice), 35);
  assert.equal(Number(line?.lineTotal), 70);
  assert.equal(Number(order?.totalAmount), 70);

  await db.delete(offerItems).where(eq(offerItems.offerId, createdOffer.id));
  await db.delete(offers).where(eq(offers.id, createdOffer.id));
});

test("createOrderFromCheckout charges the normal variant price when no single-variant offer applies", async () => {
  const ids = await getBaselineIds();

  // The baseline offer is a two-item bundle, so the product line must keep price 35.
  const result = await createOrderFromCheckout({
    ...baseCheckoutPayload(),
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
  });

  const [line] = await db
    .select({ unitPrice: orderItems.unitPrice })
    .from(orderItems)
    .where(eq(orderItems.orderId, result.id))
    .limit(1);

  assert.equal(Number(line?.unitPrice), 35);
});

test("createOrderFromCheckout applies an active variant discount and snapshots both base and final prices", async () => {
  const ids = await getBaselineIds();
  const now = Date.now();

  await db.insert(variantDiscounts).values({
    variantId: ids.firstVariantId,
    type: "percentage",
    value: "20.00",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    status: "active"
  });

  const result = await createOrderFromCheckout({
    ...baseCheckoutPayload(),
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
  });

  const [line] = await db
    .select({
      unitPrice: orderItems.unitPrice,
      lineTotal: orderItems.lineTotal,
      snapshotBaseUnitPrice: orderItems.snapshotBaseUnitPrice,
      snapshotDiscountType: orderItems.snapshotDiscountType,
      snapshotDiscountValue: orderItems.snapshotDiscountValue
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, result.id))
    .limit(1);
  const [order] = await db
    .select({ totalAmount: orders.totalAmount })
    .from(orders)
    .where(eq(orders.id, result.id))
    .limit(1);

  assert.equal(Number(line?.unitPrice), 28);
  assert.equal(Number(line?.lineTotal), 56);
  assert.equal(Number(line?.snapshotBaseUnitPrice), 35);
  assert.equal(line?.snapshotDiscountType, "percentage");
  assert.equal(Number(line?.snapshotDiscountValue), 20);
  assert.equal(Number(order?.totalAmount), 56);
});

test("createOrderFromCheckout rejects a discount that would reduce the checkout price to zero or less", async () => {
  const ids = await getBaselineIds();
  const now = Date.now();

  await db.insert(variantDiscounts).values({
    variantId: ids.firstVariantId,
    type: "fixed",
    value: "35.00",
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    status: "active"
  });

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
    }),
    /invalid discounted price/i
  );
});

test("createOrderFromCheckout rejects a variant whose product is inactive", async () => {
  const ids = await getBaselineIds();
  await db.update(products).set({ status: "inactive" }).where(eq(products.id, ids.productOneId));

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
    })
  );
});

test("createOrderFromCheckout rejects a soft-deleted product", async () => {
  const ids = await getBaselineIds();
  await db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, ids.productOneId));

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
    })
  );
});

test("createOrderFromCheckout rejects a soft-deleted variant", async () => {
  const ids = await getBaselineIds();
  await db.update(productVariants).set({ deletedAt: new Date() }).where(eq(productVariants.id, ids.firstVariantId));

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
    })
  );
});

test("createOrderFromCheckout rejects a hidden offer", async () => {
  const ids = await getBaselineIds();
  await db.update(offers).set({ visibility: "hidden" }).where(eq(offers.id, ids.offerId));

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "offer", offerId: ids.offerId, qty: 1 }]
    })
  );
});

test("createOrderFromCheckout rejects an inactive offer", async () => {
  const ids = await getBaselineIds();
  await db.update(offers).set({ status: "inactive" }).where(eq(offers.id, ids.offerId));

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "offer", offerId: ids.offerId, qty: 1 }]
    })
  );
});

test("createOrderFromCheckout rejects a soft-deleted offer", async () => {
  const ids = await getBaselineIds();
  await db.update(offers).set({ deletedAt: new Date() }).where(eq(offers.id, ids.offerId));

  await assert.rejects(
    createOrderFromCheckout({
      ...baseCheckoutPayload(),
      items: [{ type: "offer", offerId: ids.offerId, qty: 1 }]
    })
  );
});

test("createOrderFromCheckout deducts offer stock from each included variant multiplied by quantity", async () => {
  const ids = await getBaselineIds();

  await createOrderFromCheckout({
    fullName: "Checkout Offer",
    phone: "01012345678",
    email: "offer-checkout@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 2",
    buildingApartment: "Building 5",
    paymentMethod: "cod",
    items: [{ type: "offer", offerId: ids.offerId, qty: 2 }]
  });

  const variants = await db
    .select({ id: productVariants.id, stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(inArray(productVariants.id, [ids.firstVariantId, ids.secondVariantId]));

  const firstVariant = variants.find((variant) => variant.id === ids.firstVariantId);
  const secondVariant = variants.find((variant) => variant.id === ids.secondVariantId);

  assert.equal(firstVariant?.stockQty, 8);
  assert.equal(secondVariant?.stockQty, 4);
});

test("createOrderFromCheckout stores a collection order line and deducts each underlying variant multiplied by quantity", async () => {
  const ids = await getBaselineIds();

  const [createdCollection] = await db
    .insert(collections)
    .values({
      slug: `checkout-collection-${Date.now()}`,
      arName: "مجموعة دفع",
      enName: "Checkout Collection",
      fixedPrice: "90.00",
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();

  await db.insert(collectionItems).values([
    { collectionId: createdCollection.id, variantId: ids.firstVariantId, qty: 1 },
    { collectionId: createdCollection.id, variantId: ids.secondVariantId, qty: 2 }
  ]);

  const result = await createOrderFromCheckout({
    fullName: "Checkout Collection",
    phone: "01012345678",
    email: "collection-checkout@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 3",
    buildingApartment: "Building 6",
    paymentMethod: "cod",
    items: [{ type: "collection", collectionId: createdCollection.id, qty: 2 }]
  });

  const variants = await db
    .select({ id: productVariants.id, stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(inArray(productVariants.id, [ids.firstVariantId, ids.secondVariantId]));
  const [createdOrderItem] = await db
    .select({
      itemType: orderItems.itemType,
      collectionId: orderItems.collectionId,
      qty: orderItems.qty
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, result.id))
    .limit(1);

  const firstVariant = variants.find((variant) => variant.id === ids.firstVariantId);
  const secondVariant = variants.find((variant) => variant.id === ids.secondVariantId);

  assert.equal(firstVariant?.stockQty, 8);
  assert.equal(secondVariant?.stockQty, 2);
  assert.equal(createdOrderItem?.itemType, "collection");
  assert.equal(createdOrderItem?.collectionId, createdCollection.id);
  assert.equal(createdOrderItem?.qty, 2);
});
