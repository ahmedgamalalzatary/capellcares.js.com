import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, productVariants } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { createOrderFromCheckout } from "../../src/modules/orders/orders.service.js";
import { cancelCustomerOrderRepo, expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";

beforeEach(resetApiTestDatabase);

const HOUR = 60 * 60 * 1000;

async function placeOrder(variantId: number, customerId: number | null, idempotencyKey: string, now?: Date) {
  return createOrderFromCheckout({
    fullName: "Buyer",
    phone: "01012345678",
    email: "buyer@example.com",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "1 Main Street",
    buildingApartment: "Building 2",
    paymentMethod: "cod",
    customerId,
    items: [{ type: "product", variantId, qty: 2 }]
  } as Parameters<typeof createOrderFromCheckout>[0], { idempotencyKey, now });
}

async function stockOf(variantId: number) {
  const [row] = await db.select({ stock: productVariants.stockQty }).from(productVariants).where(eq(productVariants.id, variantId));
  return row!.stock;
}

async function statusOf(orderId: number) {
  const [row] = await db.select({ status: orders.paymentStatus }).from(orders).where(eq(orders.id, orderId));
  return row!.status;
}

test("an order charges only its items, with free delivery, and holds stock", async () => {
  const ids = await getBaselineIds();
  const before = await stockOf(ids.firstVariantId);
  const order = await placeOrder(ids.firstVariantId, null, "free-delivery");
  const [row] = await db.select({ total: orders.totalAmount, method: orders.paymentMethod }).from(orders).where(eq(orders.id, order.id));
  assert.equal(Number(row!.total), 70);
  assert.equal(row!.method, "cod");
  assert.equal(await stockOf(ids.firstVariantId), before - 2);
});

test("an untouched order expires after 96 hours and returns its stock", async () => {
  const ids = await getBaselineIds();
  const before = await stockOf(ids.firstVariantId);
  const placedAt = new Date("2026-01-01T00:00:00.000Z");
  const order = await placeOrder(ids.firstVariantId, null, "expiring", placedAt);

  await expirePendingCodOrders(new Date(placedAt.getTime() + 95 * HOUR));
  assert.equal(await statusOf(order.id), "pending");

  await expirePendingCodOrders(new Date(placedAt.getTime() + 97 * HOUR));
  assert.equal(await statusOf(order.id), "denied");
  assert.equal(await stockOf(ids.firstVariantId), before);
});

test("an accepted order never expires", async () => {
  const ids = await getBaselineIds();
  const placedAt = new Date("2026-01-01T00:00:00.000Z");
  const order = await placeOrder(ids.firstVariantId, null, "accepted", placedAt);
  await updateOrderPaymentStatusRepo(order.id, "accepted");

  await expirePendingCodOrders(new Date(placedAt.getTime() + 200 * HOUR));
  assert.equal(await statusOf(order.id), "accepted");
});

test("staff denying an order returns its stock", async () => {
  const ids = await getBaselineIds();
  const before = await stockOf(ids.firstVariantId);
  const order = await placeOrder(ids.firstVariantId, null, "denied");
  await updateOrderPaymentStatusRepo(order.id, "denied");
  assert.equal(await stockOf(ids.firstVariantId), before);
});

test("a customer can cancel only their own pending order", async () => {
  const ids = await getBaselineIds();
  const before = await stockOf(ids.firstVariantId);
  const order = await placeOrder(ids.firstVariantId, ids.customerId, "cancel");

  assert.equal(await cancelCustomerOrderRepo(order.id, ids.customerId + 1), "not_found");
  assert.equal(await cancelCustomerOrderRepo(order.id, ids.customerId), "cancelled");
  assert.equal(await statusOf(order.id), "denied");
  assert.equal(await stockOf(ids.firstVariantId), before);
  // A second cancel must not restock twice.
  assert.equal(await cancelCustomerOrderRepo(order.id, ids.customerId), "not_cancellable");
  assert.equal(await stockOf(ids.firstVariantId), before);
});

test("a customer cannot cancel an order staff already accepted", async () => {
  const ids = await getBaselineIds();
  const order = await placeOrder(ids.firstVariantId, ids.customerId, "accepted-cancel");
  await updateOrderPaymentStatusRepo(order.id, "accepted");
  assert.equal(await cancelCustomerOrderRepo(order.id, ids.customerId), "not_cancellable");
});
