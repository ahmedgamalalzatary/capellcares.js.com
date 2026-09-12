import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, collectionItems, collections, orderItems, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { createOrderWithItems, updateOrderPaymentStatusRepo } from "../../src/repositories/order.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

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
  const created = await createOrderWithItems({
    order: buildBaseOrder(70, "snapshot-direct@example.com"),
    items: [{ itemType: "offer", variantId: null, offerId: ids.offerId, qty: 1,
      unitPrice: 70, lineTotal: 70, snapshotComponents: [
        { variantId: ids.firstVariantId, qty: 1 }, { variantId: ids.secondVariantId, qty: 1 }
      ] }]
  });
  assert.ok(created.id > 0);
  const [first] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(first.stockQty, 9);
});

test("ERP cannot deny a paid Paymob order before Paymob confirms a full refund", async () => {
  const [order] = await db.insert(orders).values({
    orderCode: "PAY-001", customerType: "guest", fullName: "Paid Customer", phone: "01012345678",
    email: "paid-denial@example.com", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1",
    buildingApartment: "1", paymentMethod: "paymob", paymentStatus: "pending",
    providerPaymentStatus: "succeeded", totalAmount: "35.00"
  }).$returningId();
  await assert.rejects(updateOrderPaymentStatusRepo(order.id, "denied"), /refund.*Paymob.*first/i);
  const [unchanged] = await db.select().from(orders).where(eq(orders.id, order.id));
  assert.equal(unchanged.paymentStatus, "pending");
});

test("denying a fully refunded Paymob bundle restores the originally reserved components", async () => {
  const ids = await getBaselineIds();
  const [collection] = await db.insert(collections).values({ slug: `refunded-${crypto.randomUUID()}`,
    arName: "مجموعة", enName: "Refunded bundle", fixedPrice: "35.00",
    categoryId: ids.leafCategoryId, status: "active", visibility: "visible" }).$returningId();
  await db.insert(collectionItems).values({ collectionId: collection.id, variantId: ids.secondVariantId, qty: 1 });
  const [session] = await db.insert(checkoutSessions).values({ publicId: `checkout_${crypto.randomUUID()}`,
    idempotencyKey: crypto.randomUUID(), customerType: "guest", fullName: "Refunded bundle",
    phone: "+201012345678", email: "bundle-refund@example.com", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", cartSnapshot: "[]", amountCents: 3500,
    shippingAmountCents: 0, currency: "EGP", state: "completed", attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 300000) }).$returningId();
  const [attempt] = await db.insert(paymentAttempts).values({ checkoutSessionId: session.id, attemptNumber: 1,
    merchantReference: `capella_${crypto.randomUUID()}`, amountCents: 3500, currency: "EGP",
    environment: "test", status: "succeeded" }).$returningId();
  await db.insert(checkoutReservations).values({ checkoutSessionId: session.id,
    variantId: ids.firstVariantId, qty: 1, state: "finalized" });
  await db.update(productVariants).set({ stockQty: 9 }).where(eq(productVariants.id, ids.firstVariantId));
  const [order] = await db.insert(orders).values({ orderCode: "PAY-BUNDLE-1", customerType: "guest",
    fullName: "Refunded bundle", phone: "01012345678", email: "bundle-refund@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob", paymentStatus: "pending", providerPaymentStatus: "refunded",
    refundedAmountCents: 3500, paymentAttemptId: attempt.id, totalAmount: "35.00" }).$returningId();
  await db.insert(orderItems).values({ orderId: order.id, itemType: "collection", collectionId: collection.id,
    qty: 1, unitPrice: "35.00", lineTotal: "35.00" });
  const [initialSecond] = await db.select().from(productVariants).where(eq(productVariants.id, ids.secondVariantId));
  await updateOrderPaymentStatusRepo(order.id, "denied");
  const [first] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  const [second] = await db.select().from(productVariants).where(eq(productVariants.id, ids.secondVariantId));
  assert.equal(first.stockQty, 10);
  assert.equal(second.stockQty, initialSecond.stockQty);
});
