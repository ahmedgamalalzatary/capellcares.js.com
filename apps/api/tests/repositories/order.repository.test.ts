import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { productVariants } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { createOrderWithItems, updateOrderPaymentStatusRepo } from "../../src/repositories/order.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

function buildOrderInput(variantId: number, qty: number) {
  return {
    order: {
      customerType: "guest" as const,
      customerId: null,
      fullName: "Stock Tester",
      phone: "01000000000",
      email: "stock@minikoshk.test",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street",
      buildingApartment: "1",
      notes: "",
      paymentMethod: "cod" as const,
      paymentStatus: "pending" as const,
      totalAmount: 35 * qty
    },
    items: [{ variantId, qty, unitPrice: 35, lineTotal: 35 * qty }]
  };
}

async function getStock(variantId: number) {
  const [variant] = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  return variant?.stockQty ?? null;
}

test("createOrderWithItems rejects an order that exceeds available stock and rolls back", async () => {
  const ids = await getBaselineIds();
  await db.update(productVariants).set({ stockQty: 1 }).where(eq(productVariants.id, ids.firstVariantId));

  await assert.rejects(createOrderWithItems(buildOrderInput(ids.firstVariantId, 5)), /Insufficient stock/);

  assert.equal(await getStock(ids.firstVariantId), 1);
});

test("createOrderWithItems does not oversell when two orders race for the last unit", async () => {
  const ids = await getBaselineIds();
  await db.update(productVariants).set({ stockQty: 1 }).where(eq(productVariants.id, ids.firstVariantId));

  const results = await Promise.allSettled([
    createOrderWithItems(buildOrderInput(ids.firstVariantId, 1)),
    createOrderWithItems(buildOrderInput(ids.firstVariantId, 1))
  ]);

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  // Stock floored at 0 — never negative.
  assert.equal(await getStock(ids.firstVariantId), 0);
});

test("createOrderWithItems rejects offer items with null offerId before querying offerItems", async () => {
  await assert.rejects(
    createOrderWithItems({
      order: {
        customerType: "guest",
        customerId: null,
        fullName: "Stock Tester",
        phone: "01000000000",
        email: "stock@minikoshk.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street",
        buildingApartment: "1",
        notes: "",
        paymentMethod: "cod",
        paymentStatus: "pending",
        totalAmount: 35
      },
      items: [{ variantId: null, offerId: null, itemType: "offer", qty: 1, unitPrice: 35, lineTotal: 35 }]
    }),
    /item\.offerId.*offerItems/
  );
});

test("createOrderWithItems rejects non-offer items with null variantId before decrementVariantStock", async () => {
  await assert.rejects(
    createOrderWithItems({
      order: {
        customerType: "guest",
        customerId: null,
        fullName: "Stock Tester",
        phone: "01000000000",
        email: "stock@minikoshk.test",
        governorate: "Cairo",
        cityArea: "Nasr City",
        addressLine: "Street",
        buildingApartment: "1",
        notes: "",
        paymentMethod: "cod",
        paymentStatus: "pending",
        totalAmount: 35
      },
      items: [{ variantId: null, qty: 1, unitPrice: 35, lineTotal: 35 }]
    }),
    /item\.variantId.*decrementVariantStock/
  );
});

test("updateOrderPaymentStatusRepo restocks stock when an order is denied and locks the denied state", async () => {
  const ids = await getBaselineIds();
  const startingStock = await getStock(ids.firstVariantId);

  const created = await createOrderWithItems(buildOrderInput(ids.firstVariantId, 2));

  assert.equal(await getStock(ids.firstVariantId), (startingStock ?? 0) - 2);

  await updateOrderPaymentStatusRepo(created.id, "denied");

  assert.equal(await getStock(ids.firstVariantId), startingStock);

  await assert.rejects(
    updateOrderPaymentStatusRepo(created.id, "accepted"),
    /denied orders are locked/i
  );
});
