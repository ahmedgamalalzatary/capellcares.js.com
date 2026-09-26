import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderItems, shippingWorkItems, shipments, productVariants, orderReviewFlags } from "@capella/database/drizzle/schema";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { updateOrderPaymentStatusRepo, expirePendingCodOrders } from "../../src/repositories/order.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { fixtureShippingService, selectedDestination, shippingBuyer, destination } from "../helpers/checkout-shipping.js";
import { deliveryEnvironment, deliveryRateIdentity } from "../helpers/bosta-delivery.js";
import { bostaDeliveryProviderFromEnvironment } from "../../src/modules/shipping/bosta/bosta-delivery.service.js";
import { blockRefundedDelivery } from "../../src/repositories/shipping-dispatch.repository.js";

beforeEach(resetApiTestDatabase);
async function setup(fetchImpl: typeof fetch = async () => Response.json({ success: true,
  data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } })) {
  const ids = await getBaselineIds();
  const shippingService = fixtureShippingService(9729, deliveryRateIdentity);
  const payload = { ...shippingBuyer, shippingAddress: selectedDestination,
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const quote = await shippingService.quoteCheckout(payload, await priceCheckout(payload));
  const created = await createOrderFromCheckout({ ...payload, shippingQuoteId: quote.quoteId },
    { idempotencyKey: crypto.randomUUID(), shippingService });
  // DATETIME has whole-second precision; make fixture jobs unambiguously due.
  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) });
  return { ids, created, provider: bostaDeliveryProviderFromEnvironment(deliveryEnvironment, fetchImpl)! };
}
async function run(options: Record<string, unknown>) {
  const module = await import("../../src/modules/shipping/shipping-dispatch-worker.js").catch(() => null);
  assert.ok(module?.runShippingDispatchOnce, "durable shipment worker is required");
  return module.runShippingDispatchOnce(options);
}

test("worker persists request before the provider call and links the initial response without changing customer money or stock", async () => {
  const { provider, created, ids } = await setup(async (_input, init) => {
    const [job] = await db.select().from(shippingWorkItems);
    assert.equal(job.status, "processing");
    assert.deepEqual(JSON.parse(job.requestSnapshot!).payload, JSON.parse(String(init?.body)));
    return Response.json({ success: true, data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  });
  await run({ provider });
  await run({ provider });
  const [job] = await db.select().from(shippingWorkItems);
  const linked = await db.select().from(shipments);
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  const [stock] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(job.status, "succeeded");
  assert.equal(job.attemptCount, 1);
  assert.equal(linked.length, 1);
  assert.equal(linked[0].trackingNumber, "5108002");
  assert.equal(linked[0].rawProviderCode, 10);
  assert.equal(linked[0].rawProviderState, "Pickup requested");
  assert.equal(JSON.parse(job.responseSnapshot!).rawResponse.data.trackingNumber, "5108002");
  assert.equal(order.totalAmount, "132.29");
  assert.equal(stock.stockQty, 9);
});

test("concurrent workers cannot issue two create requests", async () => {
  let creates = 0;
  const { provider } = await setup(async () => {
    creates++;
    return Response.json({ success: true, data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  });
  await Promise.all([run({ provider }), run({ provider })]);
  assert.equal(creates, 1);
  assert.equal((await db.select().from(shipments)).length, 1);
});

test("throttled creation retries the frozen request after backoff, without reading changed catalog or recipient data", async () => {
  let creates = 0;
  const bodies: unknown[] = [];
  const { provider, created } = await setup(async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body))); creates++;
    return creates === 1 ? Response.json({ message: "rate limited" }, { status: 429 })
      : Response.json({ success: true, data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  });
  await run({ provider });
  const [job] = await db.select().from(shippingWorkItems);
  assert.equal(job.status, "pending");
  await run({ provider });
  assert.equal(creates, 1);
  // Current catalog data must never replace the sold contents.
  await db.update(productVariants).set({ sellingPrice: "90.00" });
  await run({ provider, now: new Date(job.nextAttemptAt.getTime() + 1000) });
  assert.equal(creates, 2);
  assert.deepEqual(bodies[1], bodies[0]);
  assert.equal((await db.select().from(orders).where(eq(orders.id, created.id)))[0].totalAmount, "132.29");
});

test("a lost create response with no proven lookup match is never resent, and errors are retained as staff flags", async () => {
  let creates = 0;
  const { provider } = await setup(async (input) => {
    if (String(input).includes("/deliveries?")) { creates++; throw new Error("secret provider failure"); }
    return Response.json({ success: true, data: { deliveries: [], total: 0 } });
  });
  await run({ provider });
  let [job] = await db.select().from(shippingWorkItems);
  assert.equal(job.status, "review_required");
  assert.equal(job.lastError, "CREATE_UNCERTAIN");
  await run({ provider, now: new Date(job.nextAttemptAt.getTime() + 1000) });
  assert.equal(creates, 1);
  [job] = await db.select().from(shippingWorkItems);
  assert.equal(job.status, "review_required");
  assert.equal(job.lastError?.includes("secret"), false);
  assert.equal((await db.select().from(orderReviewFlags)).length, 1);
});

test("restart recovers an expired claim by finding the matching delivery, without another POST create", async () => {
  let creates = 0;
  let request: any;
  const { provider, created } = await setup(async (input) => {
    if (String(input).includes("/deliveries?")) { creates++; throw new Error("Must not resend"); }
    if (String(input).endsWith("/search")) return Response.json({ success: true, data: { total: 1,
      deliveries: [{ businessReference: request.payload.businessReference, trackingNumber: "5108002" }] } });
    return Response.json({ success: true, data: { ...request.payload, trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, created.id));
  const [job] = await db.select().from(shippingWorkItems);
  request = provider.buildRequest(order, items, job.idempotencyKey);
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 1, claimedBy: "crashed",
    claimedAt: new Date(Date.now() - 300_000), requestSnapshot: JSON.stringify(request) });
  await run({ provider });
  assert.equal(creates, 0);
  assert.equal((await db.select().from(shipments)).length, 1);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "succeeded");
});

test("a rejected order or disabled sender cannot create a delivery", async () => {
  let creates = 0;
  const { provider, created } = await setup(async () => { creates++; throw new Error("Must not send"); });
  await run({ provider: null });
  assert.equal((await db.select().from(shippingWorkItems))[0].attemptCount, 0);
  await updateOrderPaymentStatusRepo(created.id, "denied");
  await run({ provider });
  assert.equal(creates, 0);
});

test("a definitive create rejection retains the order and stock and does not retry the provider", async () => {
  let creates = 0;
  const { provider, ids } = await setup(async () => { creates++; return Response.json({ message: "invalid address" }, { status: 400 }); });
  await run({ provider });
  await run({ provider, now: new Date(Date.now() + 60_000) });
  assert.equal(creates, 1);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "failed");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId)))[0].stockQty, 9);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "address_review");
});

test("a saved successful response can finish linking after restart even when sending is disabled and attempts are exhausted", async () => {
  const { provider, created } = await setup(async () => { throw new Error("No provider requests expected"); });
  const [order] = await db.select().from(orders);
  const items = await db.select().from(orderItems);
  const [job] = await db.select().from(shippingWorkItems);
  const request = provider.buildRequest(order, items, job.idempotencyKey);
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 8, claimedBy: "crashed",
    claimedAt: new Date(Date.now() - 300_000), requestSnapshot: JSON.stringify(request),
    responseSnapshot: JSON.stringify({ trackingNumber: "5108002", rawProviderCode: 10, rawProviderState: "Pickup requested",
      rawResponse: { success: true, data: { trackingNumber: "5108002" } } }) });
  await run({ provider: null });
  assert.equal((await db.select().from(shipments))[0]?.orderId, created.id);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "succeeded");
});

test("turning off new sending retains read-only recovery of uncertain deliveries", async () => {
  let creates = 0;
  let request: any;
  const { provider } = await setup();
  const [order] = await db.select().from(orders);
  const items = await db.select().from(orderItems);
  const [job] = await db.select().from(shippingWorkItems);
  request = provider.buildRequest(order, items, job.idempotencyKey);
  const recovery = bostaDeliveryProviderFromEnvironment({ ...deliveryEnvironment, BOSTA_SHIPMENT_SENDING_ENABLED: "false" }, async input => {
    if (String(input).includes("/deliveries?")) { creates++; throw new Error("Must not create"); }
    if (String(input).endsWith("/search")) return Response.json({ success: true, data: { total: 1,
      deliveries: [{ businessReference: job.idempotencyKey, trackingNumber: "5108002" }] } });
    return Response.json({ success: true, data: { ...request.payload, trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  }, { recoveryOnly: true });
  await db.update(shippingWorkItems).set({ status: "review_required", lastError: "CREATE_UNCERTAIN", attemptCount: 1,
    requestSnapshot: JSON.stringify(request) });
  await run({ provider: recovery });
  assert.equal(creates, 0);
  assert.equal((await db.select().from(shipments)).length, 1);
});

test("a late successful create after a refund is linked and flagged while stock remains held", async () => {
  let createdId = 0;
  const { provider, created, ids } = await setup(async () => {
    await db.transaction(async tx => {
      await tx.select().from(orders).where(eq(orders.id, createdId)).for("update");
      await tx.update(orders).set({ refundedAmountCents: 13229, providerPaymentStatus: "refunded" }).where(eq(orders.id, createdId));
      await blockRefundedDelivery(tx, createdId);
    });
    return Response.json({ success: true, data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  });
  createdId = created.id;
  await run({ provider });
  assert.equal((await db.select().from(shipments))[0].orderId, created.id);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId)))[0].stockQty, 9);
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "cancellation_pending");
  await assert.rejects(updateOrderPaymentStatusRepo(created.id, "denied"), /custody/i);
});

test("an expired claim missing its request stays flagged without any create or lookup request", async () => {
  let calls = 0;
  const { provider } = await setup(async () => { calls++; throw new Error("Must not call"); });
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 1, claimedAt: new Date(Date.now() - 300_000) });
  await run({ provider });
  assert.equal(calls, 0);
  assert.equal((await db.select().from(shippingWorkItems))[0].lastError, "MISSING_REQUEST_REVIEW");
});

test("a frozen request cannot be sent or reconciled using another merchant account", async () => {
  const { provider } = await setup(async () => { throw new Error("Must not call"); });
  const [order] = await db.select().from(orders);
  const items = await db.select().from(orderItems);
  const [job] = await db.select().from(shippingWorkItems);
  const request = provider.buildRequest(order, items, job.idempotencyKey);
  await db.update(shippingWorkItems).set({ requestSnapshot: JSON.stringify({ ...request, accountId: "different-account" }) });
  await run({ provider });
  assert.equal((await db.select().from(shippingWorkItems))[0].lastError, "ACCOUNT_OR_REQUEST_CHANGED");
});

test("an in-flight partial refund blocks dispatch for review without requesting full cancellation", async () => {
  const { created } = await setup();
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 1 });
  await db.transaction(async tx => {
    await tx.select().from(orders).where(eq(orders.id, created.id)).for("update");
    await tx.update(orders).set({ refundedAmountCents: 3500, providerPaymentStatus: "partially_refunded" }).where(eq(orders.id, created.id));
    await blockRefundedDelivery(tx, created.id);
  });
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "refund_review");
});

test("uncertain recovery is bounded and never creates again after its attempt limit", async () => {
  let creates = 0;
  const { provider } = await setup(async input => {
    if (String(input).includes("/deliveries?")) { creates++; throw new Error("Lost response"); }
    return Response.json({ success: true, data: { total: 0, deliveries: [] } });
  });
  await run({ provider });
  for (let attempt = 1; attempt < 9; attempt++) {
    const [job] = await db.select().from(shippingWorkItems);
    await run({ provider, now: new Date(job.nextAttemptAt.getTime() + 1000) });
  }
  const [job] = await db.select().from(shippingWorkItems);
  assert.equal(creates, 1);
  assert.equal(job.attemptCount, 8);
  assert.equal(job.lastError, "ATTEMPT_LIMIT_REVIEW");
});

test("an older delivery with a reused numeric business reference cannot be imported after a lost create response", async () => {
  let request: any;
  let oldReference = "";
  const { provider, created } = await setup(async (input, init) => {
    if (String(input).includes("/deliveries?")) { request = JSON.parse(String(init?.body)); throw new Error("Lost response"); }
    if (String(input).endsWith("/search")) return Response.json({ success: true, data: { total: 1,
      deliveries: [{ businessReference: oldReference, trackingNumber: "older-delivery" }] } });
    return Response.json({ success: true, data: { ...request, businessReference: oldReference, trackingNumber: "older-delivery",
      state: { code: 10, value: "Pickup requested" } } });
  });
  oldReference = `bosta_create_${created.id}`;
  await run({ provider });
  assert.equal((await db.select().from(shipments)).length, 0);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "review_required");
});

for (const action of ["staff rejection", "COD expiry"] as const) {
  test(`a preflight contents failure remains unsent and allows ${action} to restore stock`, async () => {
    let calls = 0;
    const { provider, created, ids } = await setup(async () => { calls++; throw new Error("Must not call the provider"); });
    await db.update(orderItems).set({ snapshotNameEn: null }).where(eq(orderItems.orderId, created.id));
    await run({ provider });
    const [job] = await db.select().from(shippingWorkItems);
    assert.equal(calls, 0);
    assert.equal(job.status, "failed");
    assert.equal(job.attemptCount, 0);
    assert.equal(job.requestSnapshot, null);
    assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "address_review");
    if (action === "staff rejection") await updateOrderPaymentStatusRepo(created.id, "denied");
    else await expirePendingCodOrders(new Date(Date.now() + 49 * 60 * 60 * 1000));
    assert.equal((await db.select().from(orders))[0].paymentStatus, "denied");
    assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId)))[0].stockQty, 10);
  });
}

test("an expired claim at the attempt limit still recovers its existing delivery through read-only lookup", async () => {
  let request: any;
  let creates = 0;
  let reads = 0;
  const { provider, created } = await setup(async input => {
    if (String(input).includes("/deliveries?")) { creates++; throw new Error("Must not create again"); }
    reads++;
    if (String(input).endsWith("/search")) return Response.json({ success: true, data: { total: 1,
      deliveries: [{ businessReference: request.payload.businessReference, trackingNumber: "5108002" }] } });
    return Response.json({ success: true, data: { ...request.payload, trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } });
  });
  const [order] = await db.select().from(orders);
  const items = await db.select().from(orderItems);
  const [job] = await db.select().from(shippingWorkItems);
  request = provider.buildRequest(order, items, job.idempotencyKey);
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 8, claimedBy: "crashed",
    claimedAt: new Date(Date.now() - 300_000), requestSnapshot: JSON.stringify(request) });
  await run({ provider });
  assert.equal(creates, 0);
  assert.equal(reads, 2);
  assert.equal((await db.select().from(shipments))[0]?.orderId, created.id);
  assert.equal((await db.select().from(shippingWorkItems))[0].status, "succeeded");
});

test("unproven recovery at the attempt limit stays flagged without allocating another create or retry cycle", async () => {
  let calls = 0;
  const { provider, ids } = await setup(async input => {
    assert.ok(String(input).endsWith("/search"), "only a read-only lookup is allowed");
    calls++;
    return Response.json({ success: true, data: { total: 0, deliveries: [] } });
  });
  const [order] = await db.select().from(orders);
  const items = await db.select().from(orderItems);
  const [job] = await db.select().from(shippingWorkItems);
  const request = provider.buildRequest(order, items, job.idempotencyKey);
  await db.update(shippingWorkItems).set({ status: "processing", attemptCount: 8, claimedBy: "crashed",
    claimedAt: new Date(Date.now() - 300_000), requestSnapshot: JSON.stringify(request) });
  await run({ provider });
  await run({ provider, now: new Date(Date.now() + 60 * 60_000) });
  assert.equal(calls, 1);
  const [finished] = await db.select().from(shippingWorkItems);
  assert.equal(finished.attemptCount, 8);
  assert.equal(finished.status, "review_required");
  assert.equal(finished.lastError, "ATTEMPT_LIMIT_REVIEW");
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "custody_review");
  assert.equal((await db.select().from(shipments)).length, 0);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId)))[0].stockQty, 9);
});
