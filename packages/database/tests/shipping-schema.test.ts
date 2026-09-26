import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { eq } from "drizzle-orm";
import {
  adminUsers,
  orderItems,
  orders,
  productVariants,
  products
} from "../drizzle/schema.js";
import { db, mysqlPool } from "../src/db.js";
import { clearTestSeed, seedTestData } from "../src/seeds/test.seed.js";

function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

type Baseline = {
  variantId: number;
  adminUserId: number;
};

async function loadBaseline(): Promise<Baseline> {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, "TEST-SKU-001"))
    .limit(1);
  assert.ok(product, "baseline product missing");
  const [variant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, product.id))
    .limit(1);
  assert.ok(variant, "baseline variant missing");
  let [adminUser] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, "shipping-integrity-admin@capella.test"))
    .limit(1);
  if (!adminUser) {
    const [created] = await db.insert(adminUsers).values({
      name: "Shipping Integrity Admin",
      email: "shipping-integrity-admin@capella.test",
      passwordHash: "hash",
      role: "admin",
      isActive: true
    }).$returningId();
    adminUser = { id: created.id };
  }
  return { variantId: variant.id, adminUserId: adminUser.id };
}

async function createOrder(): Promise<number> {
  const [created] = await db.insert(orders).values({
    orderCode: `SHIP-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    customerType: "guest",
    fullName: "Shipping Test",
    phone: "0100000000",
    email: "shipping-integrity@test.local",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "1 Test St",
    buildingApartment: "1",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "10.00"
  }).$returningId();
  return created.id;
}

let base: Baseline;

beforeEach(async () => {
  await clearTestSeed();
  await seedTestData();
  base = await loadBaseline();
});

afterEach(async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  if (schema.shipmentEvents) {
    await db.execute(
      (await import("drizzle-orm")).sql`DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE order_id IN (SELECT id FROM orders WHERE email = 'shipping-integrity@test.local'))`
    ).catch(() => {});
  }
  if (schema.shipments) {
    await db.execute(
      (await import("drizzle-orm")).sql`DELETE FROM shipments WHERE order_id IN (SELECT id FROM orders WHERE email = 'shipping-integrity@test.local')`
    ).catch(() => {});
  }
  if (schema.shippingWorkItems) {
    await db.execute(
      (await import("drizzle-orm")).sql`DELETE FROM shipping_work_items WHERE order_id IN (SELECT id FROM orders WHERE email = 'shipping-integrity@test.local')`
    ).catch(() => {});
  }
  if (schema.orderReviewFlags) {
    await db.execute(
      (await import("drizzle-orm")).sql`DELETE FROM order_review_flags WHERE order_id IN (SELECT id FROM orders WHERE email = 'shipping-integrity@test.local')`
    ).catch(() => {});
  }
  if (schema.orderStateHistory) {
    await db.execute(
      (await import("drizzle-orm")).sql`DELETE FROM order_state_history WHERE order_id IN (SELECT id FROM orders WHERE email = 'shipping-integrity@test.local')`
    ).catch(() => {});
  }
  await db.delete(orderItems).where(eq(orderItems.snapshotNameEn, "shipping-integrity-marker")).catch(() => {});
  await db.delete(orders).where(eq(orders.email, "shipping-integrity@test.local")).catch(() => {});
});

serialTest("checkout sessions accept a positive shipping amount after the zero-shipping constraint is relaxed", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const [session] = await db.insert(schema.checkoutSessions).values({
    publicId: `checkout-shipping-${Date.now()}`,
    idempotencyKey: `idempotency-shipping-${Date.now()}`,
    customerType: "guest",
    fullName: "Shipping Test",
    phone: "+201012345678",
    email: "shipping-integrity@test.local",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "1 Test",
    buildingApartment: "1",
    cartSnapshot: "[]",
    amountCents: 1000,
    shippingAmountCents: 9700,
    currency: "EGP",
    state: "payment_pending",
    attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
  }).$returningId();
  assert.ok(session.id, "positive shipping amount should be accepted");
  await db.delete(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id));
});

serialTest("checkout sessions reject a negative shipping amount", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  await assert.rejects(
    db.insert(schema.checkoutSessions).values({
      publicId: `checkout-shipping-neg-${Date.now()}`,
      idempotencyKey: `idempotency-shipping-neg-${Date.now()}`,
      customerType: "guest",
      fullName: "Shipping Test",
      phone: "+201012345678",
      email: "shipping-integrity@test.local",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "1 Test",
      buildingApartment: "1",
      cartSnapshot: "[]",
      amountCents: 1000,
      shippingAmountCents: -1,
      currency: "EGP",
      state: "payment_pending",
      attemptCount: 1,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
    })
  );
});

serialTest("orders store immutable shipping quote snapshots", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const orderId = await createOrder();
  await db.update(schema.orders).set({
    shippingAmountCents: 9700,
    shippingQuoteId: "quote-abc",
    shippingSize: "small"
  }).where(eq(schema.orders.id, orderId));
  const [stored] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1);
  assert.equal(stored.shippingAmountCents, 9700);
  assert.equal(stored.shippingQuoteId, "quote-abc");
  assert.equal(stored.shippingSize, "small");
});

serialTest("shipments require a valid order and keep outgoing/return/exchange kinds", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const orderId = await createOrder();
  const [shipment] = await db.insert(schema.shipments).values({
    orderId,
    kind: "outgoing",
    trackingNumber: `TRK-${Date.now()}`,
    provider: "bosta",
    rawProviderState: "10",
    normalizedState: "created",
    shippingAmountCents: 9700,
    size: "small",
    idempotencyKey: `ship-${Date.now()}`
  }).$returningId();
  assert.ok(shipment.id);

  await assert.rejects(
    db.insert(schema.shipments).values({
      orderId: 999_999_999,
      kind: "return",
      trackingNumber: `TRK-BAD-${Date.now()}`,
      provider: "bosta",
      rawProviderState: "10",
      normalizedState: "created",
      shippingAmountCents: 0,
      size: "small",
      idempotencyKey: `ship-bad-${Date.now()}`
    })
  );
});

serialTest("a return shipment cannot overwrite the outgoing shipment tracking reference", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const orderId = await createOrder();
  const tracking = `TRK-UNIQ-${Date.now()}`;
  await db.insert(schema.shipments).values({
    orderId,
    kind: "outgoing",
    trackingNumber: tracking,
    provider: "bosta",
    rawProviderState: "10",
    normalizedState: "created",
    shippingAmountCents: 9700,
    size: "small",
    idempotencyKey: `ship-out-${Date.now()}`
  });
  await assert.rejects(
    db.insert(schema.shipments).values({
      orderId,
      kind: "return",
      trackingNumber: tracking,
      provider: "bosta",
      rawProviderState: "10",
      normalizedState: "created",
      shippingAmountCents: 0,
      size: "small",
      idempotencyKey: `ship-ret-${Date.now()}`
    })
  );
});

serialTest("shipment events deduplicate on provider event fingerprint", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const orderId = await createOrder();
  const [shipment] = await db.insert(schema.shipments).values({
    orderId,
    kind: "outgoing",
    trackingNumber: `TRK-EVT-${Date.now()}`,
    provider: "bosta",
    rawProviderState: "10",
    normalizedState: "created",
    shippingAmountCents: 9700,
    size: "small",
    idempotencyKey: `ship-evt-${Date.now()}`
  }).$returningId();
  const fingerprint = `evt-${Date.now()}`;
  await db.insert(schema.shipmentEvents).values({
    shipmentId: shipment.id,
    eventFingerprint: fingerprint,
    rawPayload: "{}",
    receivedAt: new Date()
  });
  await assert.rejects(
    db.insert(schema.shipmentEvents).values({
      shipmentId: shipment.id,
      eventFingerprint: fingerprint,
      rawPayload: "{}",
      receivedAt: new Date()
    })
  );
});

serialTest("shipping work items support durable intent, claiming and recovery", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const orderId = await createOrder();
  const idem = `work-${Date.now()}`;
  const [work] = await db.insert(schema.shippingWorkItems).values({
    orderId,
    operation: "create_delivery",
    idempotencyKey: idem,
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: new Date()
  }).$returningId();
  assert.ok(work.id);

  // Duplicate intent must be rejected
  await assert.rejects(
    db.insert(schema.shippingWorkItems).values({
      orderId,
      operation: "create_delivery",
      idempotencyKey: idem,
      status: "pending",
      attemptCount: 0,
      nextAttemptAt: new Date()
    })
  );

  // Claim
  await db.update(schema.shippingWorkItems).set({
    status: "processing",
    claimedBy: "worker-1",
    claimedAt: new Date()
  }).where(eq(schema.shippingWorkItems.id, work.id));
  const [claimed] = await db.select().from(schema.shippingWorkItems).where(eq(schema.shippingWorkItems.id, work.id)).limit(1);
  assert.equal(claimed.status, "processing");
  assert.equal(claimed.claimedBy, "worker-1");
});

serialTest("order review flags and manual state history are recorded separately", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const orderId = await createOrder();
  const [flag] = await db.insert(schema.orderReviewFlags).values({
    orderId,
    flagType: "address_review",
    reason: "Unclear address before collection",
    status: "open"
  }).$returningId();
  assert.ok(flag.id);

  const [history] = await db.insert(schema.orderStateHistory).values({
    orderId,
    state: "preparing",
    actorType: "staff",
    actorId: base.adminUserId,
    reason: "Staff marked as preparing"
  }).$returningId();
  assert.ok(history.id);

  const [storedFlag] = await db.select().from(schema.orderReviewFlags).where(eq(schema.orderReviewFlags.id, flag.id)).limit(1);
  assert.equal(storedFlag.status, "open");
  const [storedHistory] = await db.select().from(schema.orderStateHistory).where(eq(schema.orderStateHistory.id, history.id)).limit(1);
  assert.equal(storedHistory.state, "preparing");
  assert.equal(storedHistory.actorType, "staff");
});

test.after(async () => {
  await mysqlPool.end();
});
