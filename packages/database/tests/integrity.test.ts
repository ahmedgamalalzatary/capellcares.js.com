import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { and, eq } from "drizzle-orm";
import {
  adminUsers,
  authSessions,
  categories,
  entityOrderings,
  customers,
  entityMedia,
  offerItems,
  offers,
  orderItems,
  orders,
  productVariants,
  products,
  wishlists
} from "../drizzle/schema.js";
import { db, mysqlPool } from "../src/db.js";
import { clearTestSeed, seedTestData } from "../src/seeds/test.seed.js";

const MISSING_ID = 999_999_999;
function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

type Baseline = {
  customerId: number;
  adminUserId: number;
  productId: number;
  variantId: number;
  secondVariantId: number;
  offerId: number;
};

async function loadBaseline(): Promise<Baseline> {
  const [firstProduct] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, "TEST-SKU-001"))
    .limit(1);
  const [secondProduct] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.sku, "TEST-SKU-002"))
    .limit(1);
  const [offer] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(eq(offers.slug, "test-offer-baseline"))
    .limit(1);
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, "seed-customer@capella.test"))
    .limit(1);
  let [adminUser] = await db
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(eq(adminUsers.email, "integrity-admin@capella.test"))
    .limit(1);

  if (!adminUser) {
    const [createdAdmin] = await db.insert(adminUsers).values({
      name: "Integrity Admin",
      email: "integrity-admin@capella.test",
      passwordHash: "hash",
      role: "admin",
      isActive: true
    }).$returningId();
    adminUser = { id: createdAdmin.id };
  }

  assert.ok(firstProduct && secondProduct && offer && customer && adminUser, "baseline seed incomplete");

  const [firstVariant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, firstProduct.id))
    .limit(1);
  const [secondVariant] = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.productId, secondProduct.id))
    .limit(1);

  assert.ok(firstVariant && secondVariant, "baseline variants missing");

  return {
    customerId: customer.id,
    adminUserId: adminUser.id,
    productId: firstProduct.id,
    variantId: firstVariant.id,
    secondVariantId: secondVariant.id,
    offerId: offer.id
  };
}

async function createOrder(): Promise<number> {
  const [created] = await db
    .insert(orders)
    .values({
      orderCode: `INTEG-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      customerType: "guest",
      fullName: "Integrity Test",
      phone: "0100000000",
      email: "integrity@test.local",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "1 Test St",
      buildingApartment: "1",
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: "10.00"
    })
    .$returningId();
  return created.id;
}

let base: Baseline;

beforeEach(async () => {
  await clearTestSeed();
  await seedTestData();
  base = await loadBaseline();
});

afterEach(async () => {
  // Remove anything a test may have inserted, tolerating either pre- or
  // post-constraint behavior.
  await db.delete(orderItems).where(eq(orderItems.snapshotNameEn, "integrity-marker")).catch(() => {});
  await db.delete(orders).where(eq(orders.email, "integrity@test.local")).catch(() => {});
  await db
    .delete(wishlists)
    .where(
      and(
        eq(wishlists.entityType, "product"),
        eq(wishlists.entityId, base?.productId ?? MISSING_ID)
      )
    )
    .catch(() => {});
});

serialTest("clearTestSeed removes unified ordering rows", async () => {
  await db.insert(entityOrderings).values({
    scopeType: "root",
    scopeId: null,
    entityType: "product",
    entityId: MISSING_ID,
    rank: MISSING_ID
  });

  await clearTestSeed();

  const rows = await db.select({ id: entityOrderings.id }).from(entityOrderings);
  assert.equal(rows.length, 0);
});

serialTest("seeds the baseline offer under a root category", async () => {
  const [offer] = await db
    .select({ categoryId: offers.categoryId })
    .from(offers)
    .where(eq(offers.id, base.offerId))
    .limit(1);
  assert.ok(offer?.categoryId, "baseline offer should be classified");

  const [category] = await db
    .select({ parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.id, offer!.categoryId!))
    .limit(1);
  assert.equal(category?.parentId, null, "offers may only be classified under a root category");
});

serialTest("rejects offer_items with a non-existent variant_id", async () => {
  await assert.rejects(
    db.insert(offerItems).values({ offerId: base.offerId, variantId: MISSING_ID, qty: 1 })
  );
});

serialTest("entity_media requires exactly one valid owner", async () => {
  await assert.rejects(
    db.insert(entityMedia).values({
      mediaType: "image",
      url: "/uploads/no-owner.jpg",
      sortOrder: 1
    })
  );

  await assert.rejects(
    db.insert(entityMedia).values({
      productId: base.productId,
      offerId: base.offerId,
      mediaType: "image",
      url: "/uploads/two-owners.jpg",
      sortOrder: 1
    })
  );

  await db.insert(entityMedia).values({
    productId: base.productId,
    mediaType: "image",
    url: "/uploads/valid-owner.jpg",
    sortOrder: 1
  });
});

serialTest("deleting an entity cascades its entity_media rows", async () => {
  const [offer] = await db
    .insert(offers)
    .values({
      slug: `media-cascade-${Date.now()}`,
      arName: "x",
      enName: "x",
      fixedPrice: "10.00"
    })
    .$returningId();

  await db.insert(entityMedia).values({
    offerId: offer.id,
    mediaType: "image",
    url: "/uploads/cascade.jpg",
    sortOrder: 1
  });
  await db.delete(offers).where(eq(offers.id, offer.id));

  const rows = await db.select({ id: entityMedia.id }).from(entityMedia).where(eq(entityMedia.offerId, offer.id));
  assert.equal(rows.length, 0);
});

serialTest("rejects offer_items with a non-existent offer_id", async () => {
  await assert.rejects(
    db.insert(offerItems).values({ offerId: MISSING_ID, variantId: base.variantId, qty: 1 })
  );
});

serialTest("rejects order_items with a non-existent variant_id", async () => {
  const orderId = await createOrder();
  await assert.rejects(
    db.insert(orderItems).values({
      orderId,
      itemType: "product_variant",
      variantId: MISSING_ID,
      qty: 1,
      unitPrice: "10.00",
      lineTotal: "10.00",
      snapshotNameEn: "integrity-marker"
    })
  );
});

serialTest("rejects a duplicate wishlists (customer_id, entity_type, entity_id)", async () => {
  const customerId = base.customerId;
  await db.insert(wishlists).values({ customerId, entityType: "product", entityId: base.productId });
  await assert.rejects(
    db.insert(wishlists).values({ customerId, entityType: "product", entityId: base.productId })
  );
});

serialTest("rejects wishlists with a non-existent customer_id", async () => {
  await assert.rejects(
    db.insert(wishlists).values({ customerId: MISSING_ID, entityType: "product", entityId: base.productId })
  );
});

serialTest("allows wishlists to reference missing entities until repository validation runs", async () => {
  await db.insert(wishlists).values({ customerId: base.customerId, entityType: "product", entityId: MISSING_ID });

  const rows = await db
    .select({ customerId: wishlists.customerId, entityType: wishlists.entityType, entityId: wishlists.entityId })
    .from(wishlists)
    .where(
      and(
        eq(wishlists.customerId, base.customerId),
        eq(wishlists.entityType, "product"),
        eq(wishlists.entityId, MISSING_ID)
      )
    );
  assert.equal(rows.length, 1);
});

serialTest("rejects auth_sessions with a non-existent customer_id", async () => {
  await assert.rejects(
    db.insert(authSessions).values({
      accountType: "customer",
      customerId: MISSING_ID,
      tokenHash: `missing-customer-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60_000)
    })
  );
});

serialTest("rejects auth_sessions with a non-existent admin_user_id", async () => {
  await assert.rejects(
    db.insert(authSessions).values({
      accountType: "admin",
      adminUserId: MISSING_ID,
      tokenHash: `missing-admin-${Date.now()}`,
      expiresAt: new Date(Date.now() + 60_000)
    })
  );
});

serialTest("rejects orders with a non-existent customer_id", async () => {
  await assert.rejects(
    db.insert(orders).values({
      orderCode: `INTEG-BAD-CUSTOMER-${Date.now()}`,
      customerType: "registered",
      customerId: MISSING_ID,
      fullName: "Integrity Test",
      phone: "0100000000",
      email: "integrity@test.local",
      governorate: "Cairo",
      cityArea: "Nasr City",
      addressLine: "1 Test St",
      buildingApartment: "1",
      paymentMethod: "cod",
      paymentStatus: "pending",
      totalAmount: "10.00"
    })
  );
});

serialTest("rejects a duplicate offer_items (offer_id, variant_id)", async () => {
  // Baseline already seeds one (offerId, variantId) row; a second must be rejected.
  await assert.rejects(
    db.insert(offerItems).values({ offerId: base.offerId, variantId: base.variantId, qty: 1 })
  );
});

serialTest("rejects a duplicate product_variants (product_id, size_label)", async () => {
  const [existing] = await db
    .select({ sizeLabel: productVariants.sizeLabel })
    .from(productVariants)
    .where(eq(productVariants.id, base.variantId))
    .limit(1);
  await assert.rejects(
    db.insert(productVariants).values({
      productId: base.productId,
      sizeLabel: existing!.sizeLabel,
      sellingPrice: "9.99",
      stockQty: 1
    })
  );
});

serialTest("deleting an offer cascades its offer_items", async () => {
  const [offer] = await db
    .insert(offers)
    .values({
      slug: `integ-cascade-${Date.now()}`,
      arName: "x",
      enName: "x",
      fixedPrice: "10.00"
    })
    .$returningId();
  await db.insert(offerItems).values({ offerId: offer.id, variantId: base.variantId, qty: 1 });

  await db.delete(offers).where(eq(offers.id, offer.id));

  const remaining = await db.select().from(offerItems).where(eq(offerItems.offerId, offer.id));
  assert.equal(remaining.length, 0);
});

serialTest("blocks deleting a product_variant referenced by an offer_item (RESTRICT)", async () => {
  // Baseline seeds an offer_item for base.variantId.
  await assert.rejects(
    db.delete(productVariants).where(eq(productVariants.id, base.variantId))
  );
});

serialTest("blocks deleting a product_variant referenced by an order_item (RESTRICT)", async () => {
  const orderId = await createOrder();
  await db.insert(orderItems).values({
    orderId,
    itemType: "product_variant",
    variantId: base.secondVariantId,
    qty: 1,
    unitPrice: "10.00",
    lineTotal: "10.00",
    snapshotNameEn: "integrity-marker"
  });

  await assert.rejects(
    db.delete(productVariants).where(eq(productVariants.id, base.secondVariantId))
  );
});

serialTest("supports soft-deleting a product_variant via deleted_at", async () => {
  await db
    .update(productVariants)
    .set({ deletedAt: new Date() } as any)
    .where(eq(productVariants.id, base.variantId));

  const [row] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, base.variantId)))
    .limit(1);
  assert.ok((row as any).deletedAt, "deleted_at should be set");

  // restore
  await db
    .update(productVariants)
    .set({ deletedAt: null } as any)
    .where(eq(productVariants.id, base.variantId));
});

serialTest("allows a new active variant with the same size after the old one is soft-deleted", async () => {
  const [existing] = await db
    .select({ sizeLabel: productVariants.sizeLabel })
    .from(productVariants)
    .where(eq(productVariants.id, base.variantId))
    .limit(1);

  await db
    .update(productVariants)
    .set({ deletedAt: new Date() } as any)
    .where(eq(productVariants.id, base.variantId));

  const [created] = await db
    .insert(productVariants)
    .values({
      productId: base.productId,
      sizeLabel: existing!.sizeLabel,
      sellingPrice: "12.50",
      stockQty: 3
    })
    .$returningId();
  assert.ok(created.id, "new same-size active variant should be allowed");

  await db.delete(productVariants).where(eq(productVariants.id, created.id));
  await db
    .update(productVariants)
    .set({ deletedAt: null } as any)
    .where(eq(productVariants.id, base.variantId));
});

serialTest("payment sessions persist reservations and reject attempts beyond three", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  assert.ok(schema.checkoutSessions, "checkoutSessions table must exist");
  assert.ok(schema.checkoutReservations, "checkoutReservations table must exist");
  assert.ok(schema.paymentAttempts, "paymentAttempts table must exist");

  const publicId = `checkout-${Date.now()}`;
  const [session] = await db.insert(schema.checkoutSessions).values({
    publicId,
    idempotencyKey: `idempotency-${Date.now()}`,
    customerType: "guest",
    fullName: "Payment Test",
    phone: "+201012345678",
    email: "payment@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "1 Payment Street",
    buildingApartment: "1",
    cartSnapshot: "[]",
    amountCents: 1000,
    shippingAmountCents: 0,
    currency: "EGP",
    state: "payment_pending",
    attemptCount: 1,
    reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
  }).$returningId();

  try {
    await db.insert(schema.checkoutReservations).values({
      checkoutSessionId: session.id,
      variantId: base.secondVariantId,
      qty: 1,
      state: "reserved"
    });
    await assert.rejects(db.insert(schema.paymentAttempts).values({
      checkoutSessionId: session.id,
      attemptNumber: 4,
      merchantReference: `attempt-four-${Date.now()}`,
      amountCents: 1000,
      currency: "EGP",
      environment: "test",
      status: "created"
    }));
  } finally {
    await db.delete(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id));
  }
});

serialTest("payment webhook events reject duplicate provider fingerprints", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  assert.ok(schema.paymentWebhookEvents, "paymentWebhookEvents table must exist");
  const fingerprint = `paymob-${Date.now()}`;
  await db.insert(schema.paymentWebhookEvents).values({
    provider: "paymob",
    callbackType: "transaction",
    eventFingerprint: fingerprint,
    processingStatus: "processed"
  });
  await assert.rejects(db.insert(schema.paymentWebhookEvents).values({
    provider: "paymob",
    callbackType: "transaction",
    eventFingerprint: fingerprint,
    processingStatus: "processed"
  }));
  await db.delete(schema.paymentWebhookEvents).where(eq(schema.paymentWebhookEvents.eventFingerprint, fingerprint));
});

serialTest("payment attempts reject duplicate Paymob intention identifiers", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const [session] = await db.insert(schema.checkoutSessions).values({
    publicId: `checkout-provider-${Date.now()}`,
    idempotencyKey: `idempotency-provider-${Date.now()}`,
    customerType: "guest", fullName: "Provider Test", phone: "+201012345678",
    email: "provider@capella.test", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "1 Test", buildingApartment: "1", cartSnapshot: "[]",
    amountCents: 1000, shippingAmountCents: 0, currency: "EGP", state: "payment_pending",
    attemptCount: 2, reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000)
  }).$returningId();
  const attempts = schema.paymentAttempts as any;
  try {
    await db.insert(attempts).values({
      checkoutSessionId: session.id, attemptNumber: 1, merchantReference: `ref-1-${Date.now()}`,
      amountCents: 1000, currency: "EGP", environment: "test", status: "pending",
      paymobIntentionId: "pi_test_duplicate", paymobOrderId: "9001", clientSecret: "client-1",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });
    await assert.rejects(db.insert(attempts).values({
      checkoutSessionId: session.id, attemptNumber: 2, merchantReference: `ref-2-${Date.now()}`,
      amountCents: 1000, currency: "EGP", environment: "test", status: "pending",
      paymobIntentionId: "pi_test_duplicate", paymobOrderId: "9002", clientSecret: "client-2",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    }));
  } finally {
    await db.delete(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id));
  }
});

serialTest("orders can link a successful Paymob attempt without using the operational status as payment truth", async () => {
  const schema = await import("../drizzle/schema.js") as Record<string, any>;
  const [session] = await db.insert(schema.checkoutSessions).values({
    publicId: `checkout-order-${Date.now()}`, idempotencyKey: `idempotency-order-${Date.now()}`,
    customerType: "guest", fullName: "Paid Test", phone: "+201012345678", email: "paid@capella.test",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "1 Test", buildingApartment: "1",
    cartSnapshot: "[]", amountCents: 1000, shippingAmountCents: 0, currency: "EGP",
    state: "payment_pending", attemptCount: 1, reservationExpiresAt: new Date(Date.now() + 1800000)
  }).$returningId();
  const [attempt] = await db.insert(schema.paymentAttempts).values({
    checkoutSessionId: session.id, attemptNumber: 1, merchantReference: `paid-ref-${Date.now()}`,
    amountCents: 1000, currency: "EGP", environment: "test", status: "succeeded"
  }).$returningId();
  const [order] = await db.insert(schema.orders as any).values({
    orderCode: `PAID-${Date.now()}`, customerType: "guest", fullName: "Paid Test", phone: "+201012345678",
    email: "paid@capella.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "1 Test",
    buildingApartment: "1", paymentMethod: "paymob", paymentStatus: "pending",
    providerPaymentStatus: "succeeded", paymentAttemptId: attempt.id, totalAmount: "10.00"
  }).$returningId();
  const [stored] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)).limit(1);
  assert.equal(stored.paymentStatus, "pending");
  assert.equal(stored.providerPaymentStatus, "succeeded");
  assert.equal(stored.paymentAttemptId, attempt.id);
  await db.delete(schema.orders).where(eq(schema.orders.id, order.id));
  await db.delete(schema.checkoutSessions).where(eq(schema.checkoutSessions.id, session.id));
});

test.after(async () => {
  await mysqlPool.end();
});
