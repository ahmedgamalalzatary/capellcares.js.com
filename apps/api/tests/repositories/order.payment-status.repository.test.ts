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

test("ERP cannot manually mark a Paymob order pending or accepted", async () => {
  const [order] = await db.insert(orders).values({
    orderCode: `PAY-${crypto.randomUUID().slice(0, 8)}`, customerType: "guest", customerId: null,
    fullName: "Paid customer", phone: "01012345678", email: "manual-paymob@example.com", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
    paymentStatus: "accepted", providerPaymentStatus: "succeeded", totalAmount: "35.00"
  }).$returningId();

  await assert.rejects(updateOrderPaymentStatusRepo(order.id, "pending"), /managed by paymob/i);
  await assert.rejects(updateOrderPaymentStatusRepo(order.id, "accepted"), /managed by paymob/i);
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

test("orders reject a negative refunded amount at the database level", async () => {
  await assert.rejects(
    db.insert(orders).values({
      orderCode: `NEG-${Date.now()}`,
      customerType: "guest",
      fullName: "Negative Refund",
      phone: "01000000000",
      email: "negative-refund@capella.test",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street",
      buildingApartment: "1",
      paymentMethod: "cod",
      paymentStatus: "pending",
      refundedAmountCents: -1,
      totalAmount: "10.00"
    }),
    (error: unknown) => {
      // Drizzle wraps the driver error, so the constraint name lives on the cause.
      const cause = (error as { cause?: unknown } | null)?.cause;
      return /orders_refunded_amount_cents_check/i.test(`${String(error)} ${String(cause)}`);
    }
  );
});

test("orders cannot reference a payment attempt that does not exist", async () => {
  await assert.rejects(
    db.insert(orders).values({
      orderCode: `FK-${Date.now()}`,
      customerType: "guest",
      fullName: "Missing Attempt",
      phone: "01000000000",
      email: "missing-attempt@capella.test",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "Street",
      buildingApartment: "1",
      paymentMethod: "paymob",
      paymentStatus: "pending",
      paymentAttemptId: 999999,
      totalAmount: "10.00"
    }),
    (error: unknown) => {
      const cause = (error as { cause?: unknown } | null)?.cause;
      return /foreign key constraint fails/i.test(`${String(error)} ${String(cause)}`);
    }
  );
});
