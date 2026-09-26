import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shippingWorkItems, productVariants, orderReviewFlags } from "@capella/database/drizzle/schema";
import { updateOrderPaymentStatusRepo, expirePendingCodOrders } from "../../src/repositories/order.repository.js";
import { enqueueOrderDelivery } from "../../src/repositories/shipping-dispatch.repository.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { fixtureShippingService, selectedDestination, shippingBuyer } from "../helpers/checkout-shipping.js";

beforeEach(resetApiTestDatabase);

async function shippingOrder() {
  const ids = await getBaselineIds();
  const shippingService = fixtureShippingService();
  const payload = { ...shippingBuyer, shippingAddress: selectedDestination,
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const quote = await shippingService.quoteCheckout(payload, await priceCheckout(payload));
  const request = { ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 13229 };
  const options = { idempotencyKey: crypto.randomUUID(), shippingService };
  return { ids, request, options, created: await createOrderFromCheckout(request, options) };
}

test("shipping COD creation commits one durable intent and replay cannot allocate another", async () => {
  const { created, request, options } = await shippingOrder();
  await createOrderFromCheckout(request, options);
  const jobs = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, created.id));
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].operation, "create_delivery");
  assert.equal(jobs[0].status, "pending");
  assert.equal(jobs[0].attemptCount, 0);
  assert.equal((await db.select().from(orders)).length, 1);
});

test("re-enqueuing an existing order retains its original delivery reference", async () => {
  const { created } = await shippingOrder();
  const [original] = await db.select().from(shippingWorkItems);
  await db.transaction(tx => enqueueOrderDelivery(tx, created.id));
  const jobs = await db.select().from(shippingWorkItems);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].idempotencyKey, original.idempotencyKey);
});

test("legacy checkout without shipping does not create a delivery intent or import historical orders", async () => {
  const ids = await getBaselineIds();
  await createOrderFromCheckout({ ...shippingBuyer,
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] });
  assert.equal((await db.select().from(shippingWorkItems)).length, 0);
});

test("rejecting an unsent order stops its delivery job before restoring stock", async () => {
  const { created, ids } = await shippingOrder();
  await updateOrderPaymentStatusRepo(created.id, "denied");
  const [job] = await db.select().from(shippingWorkItems);
  assert.equal(job.status, "failed");
  const [stock] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(stock.stockQty, 10);
});

test("an in-flight delivery prevents staff rejection and automatic expiry from restoring stock", async () => {
  const { created, ids } = await shippingOrder();
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 1, claimedBy: "lost-worker", claimedAt: new Date() });
  await assert.rejects(updateOrderPaymentStatusRepo(created.id, "denied"), /shipping|custody/i);
  await expirePendingCodOrders(new Date(Date.now() + 49 * 60 * 60 * 1000));
  const [stock] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  const [order] = await db.select().from(orders);
  assert.equal(stock.stockQty, 9);
  assert.equal(order.paymentStatus, "pending");
  const flags = await db.select().from(orderReviewFlags);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flagType, "expiry_review");
  await expirePendingCodOrders(new Date(Date.now() + 50 * 60 * 60 * 1000));
  assert.equal((await db.select().from(orderReviewFlags)).length, 1);
});
