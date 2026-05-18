import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq, inArray } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { createOrderFromCheckout } from "../../src/modules/orders/orders.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

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
