import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, collectionItems, collections, orderItems, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { createOrderWithItems, updateOrderPaymentStatusRepo } from "../../../src/modules/orders/order.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

function buildBaseOrder(totalAmount: number, email: string) {
  return {
    customerType: "guest" as const,
    customerId: null,
    fullName: "Payment Status Guard",
    phone: "01000000000",
    email,
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street",
    buildingApartment: "1",
    notes: "",
    paymentMethod: "cod" as const,
    paymentStatus: "pending" as const,
    totalAmount
  };
}

test("updateOrderPaymentStatusRepo rejects missing identifiers when restocking denied orders", async () => {
  const ids = await getBaselineIds();

  const offerOrder = await createOrderWithItems({
    order: buildBaseOrder(35, "offer-restock@capella.test"),
    items: [{ variantId: null, offerId: ids.offerId, itemType: "offer", qty: 1, unitPrice: 35, lineTotal: 35 }]
  });
  await db.update(orderItems).set({ offerId: null, snapshotComponents: null }).where(eq(orderItems.orderId, offerOrder.id));
  await assert.rejects(
    updateOrderPaymentStatusRepo(offerOrder.id, "denied"),
    /orderId=.*offer.*offerId/i
  );

  const [createdCollection] = await db
    .insert(collections)
    .values({
      slug: `restock-collection-${Date.now()}`,
      arName: "مجموعة استرجاع",
      enName: "Restock Collection",
      fixedPrice: "90.00",
      categoryId: ids.leafCategoryId,
      status: "active",
      visibility: "visible"
    })
    .$returningId();
  await db.insert(collectionItems).values({ collectionId: createdCollection.id, variantId: ids.firstVariantId, qty: 1 });

  const collectionOrder = await createOrderWithItems({
    order: buildBaseOrder(90, "collection-restock@capella.test"),
    items: [{ variantId: null, collectionId: createdCollection.id, itemType: "collection", qty: 1, unitPrice: 90, lineTotal: 90 }]
  });
  await db.update(orderItems).set({ collectionId: null, snapshotComponents: null }).where(eq(orderItems.orderId, collectionOrder.id));
  await assert.rejects(
    updateOrderPaymentStatusRepo(collectionOrder.id, "denied"),
    /orderId=.*collection.*collectionId/i
  );

  const variantOrder = await createOrderWithItems({
    order: buildBaseOrder(35, "variant-restock@capella.test"),
    items: [{ variantId: ids.firstVariantId, qty: 1, unitPrice: 35, lineTotal: 35 }]
  });
  await db.update(orderItems).set({ variantId: null }).where(eq(orderItems.orderId, variantOrder.id));
  await assert.rejects(
    updateOrderPaymentStatusRepo(variantOrder.id, "denied"),
    /orderId=.*variantId/i
  );
});

test("updateOrderPaymentStatusRepo reports a malformed bundle snapshot with the intended error", async () => {
  const ids = await getBaselineIds();

  const offerOrder = await createOrderWithItems({
    order: buildBaseOrder(35, "malformed-snapshot@capella.test"),
    items: [{ variantId: null, offerId: ids.offerId, itemType: "offer", qty: 1, unitPrice: 35, lineTotal: 35 }]
  });
  await db.update(orderItems).set({ snapshotComponents: "{ not json" }).where(eq(orderItems.orderId, offerOrder.id));

  await assert.rejects(
    updateOrderPaymentStatusRepo(offerOrder.id, "denied"),
    /Bundle component snapshot is invalid/
  );
});

test("updateOrderPaymentStatusRepo throws when the order does not exist", async () => {
  await assert.rejects(
    updateOrderPaymentStatusRepo(999999, "accepted"),
    /order not found/i
  );
});

test("a snapshotted COD bundle can be sold after its catalog component rows change", async () => {
  const ids = await getBaselineIds();
  const { offerItems } = await import("@capella/database/drizzle/schema");
  await db.delete(offerItems).where(eq(offerItems.offerId, ids.offerId));
  const [secondBefore] = await db.select().from(productVariants).where(eq(productVariants.id, ids.secondVariantId));
  const created = await createOrderWithItems({
    order: buildBaseOrder(70, "snapshot-direct@example.com"),
    items: [{ itemType: "offer", variantId: null, offerId: ids.offerId, qty: 1,
      unitPrice: 70, lineTotal: 70, snapshotComponents: [
        { variantId: ids.firstVariantId, qty: 1 }, { variantId: ids.secondVariantId, qty: 1 }
      ] }]
  });
  assert.ok(created.id > 0);
  const [first] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  const [second] = await db.select().from(productVariants).where(eq(productVariants.id, ids.secondVariantId));
  assert.equal(first.stockQty, 9);
  assert.equal(second.stockQty, secondBefore.stockQty - 1);
});
