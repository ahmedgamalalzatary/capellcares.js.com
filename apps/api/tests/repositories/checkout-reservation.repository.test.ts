import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db, mysqlPool } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, productVariants } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(resetApiTestDatabase);

function sessionInput(variantId: number) {
  return {
    publicId: `checkout_${crypto.randomUUID()}`,
    idempotencyKey: crypto.randomUUID(),
    customerType: "guest" as const,
    customerId: null,
    fullName: "Reservation Test",
    phone: "+201012345678",
    email: "reservation@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "1 Test Street",
    buildingApartment: "1",
    notes: "",
    cartSnapshot: "[]",
    amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    reservations: [{ variantId, qty: 2 }]
  };
}

test("createReservedCheckout atomically removes reserved stock", async () => {
  const module = await import("../../src/repositories/checkout/checkout-reservation.repository.js").catch(() => null);
  const ids = await getBaselineIds();

  const result = await module?.createReservedCheckout(sessionInput(ids.firstVariantId));
  const [variant] = await db.select({ stockQty: productVariants.stockQty })
    .from(productVariants).where(eq(productVariants.id, ids.firstVariantId)).limit(1);
  const [reservation] = await db.select().from(checkoutReservations)
    .where(eq(checkoutReservations.checkoutSessionId, result?.id ?? -1)).limit(1);

  assert.equal(variant?.stockQty, 8);
  assert.equal(reservation?.qty, 2);
  assert.equal(reservation?.state, "reserved");
});

test("expiry sweeps a bounded batch of candidates instead of locking every expired session", async () => {
  const module = await import("../../src/repositories/checkout/checkout-reservation.repository.js").catch(() => null);
  const ids = await getBaselineIds();
  // Three expired sessions exist; the batch size is deliberately smaller than that.
  for (let index = 0; index < 3; index += 1) {
    await module?.createReservedCheckout({ ...sessionInput(ids.firstVariantId),
      reservations: [{ variantId: ids.firstVariantId, qty: 1 }],
      reservationExpiresAt: new Date(Date.now() - 60_000) });
  }
  const candidates = await module?.discoverExpiredSessionIds(new Date(), 2);
  assert.equal(candidates?.length, 2, "discovery is bounded by the batch size, never a full range scan");
});

test("expiry skips a candidate whose state changed after discovery instead of acting on stale data", async () => {
  const module = await import("../../src/repositories/checkout/checkout-reservation.repository.js").catch(() => null);
  const ids = await getBaselineIds();
  const created = await module?.createReservedCheckout({ ...sessionInput(ids.firstVariantId),
    reservations: [{ variantId: ids.firstVariantId, qty: 2 }],
    reservationExpiresAt: new Date(Date.now() - 60_000) });
  const candidateIds = await module?.discoverExpiredSessionIds(new Date(), 10);
  assert.ok(candidateIds?.includes(created!.id), "the expired session is a candidate");

  // The customer completes checkout between discovery and the per-session recheck.
  await db.update(checkoutSessions).set({ state: "completed" })
    .where(eq(checkoutSessions.id, created!.id));

  await module?.releaseExpiredCheckoutReservations(new Date());

  const [variant] = await db.select({ stockQty: productVariants.stockQty })
    .from(productVariants).where(eq(productVariants.id, ids.firstVariantId)).limit(1);
  assert.equal(variant?.stockQty, 8, "a completed checkout keeps its reserved stock; the next sweep re-evaluates it");
  const [reservation] = await db.select().from(checkoutReservations)
    .where(eq(checkoutReservations.checkoutSessionId, created!.id)).limit(1);
  assert.equal(reservation?.state, "reserved", "the reservation is untouched by the stale candidate");
});

test("expiry waits for the payment session lock before releasing any stock", async () => {
  const module = await import("../../src/repositories/checkout/checkout-reservation.repository.js").catch(() => null);
  const ids = await getBaselineIds();
  const input = sessionInput(ids.firstVariantId);
  input.reservationExpiresAt = new Date(Date.now() - 1000);
  const session = await module?.createReservedCheckout(input);

  // A real MySQL lock-wait timeout establishes contention, unlike an arbitrary
  // sleep. Apply the short timeout only to expiry's real transaction connection.
  const getConnection = mysqlPool.getConnection;
  const payment = await mysqlPool.getConnection();
  let expiryConnection: Awaited<ReturnType<typeof mysqlPool.getConnection>> | undefined;
  try {
    await payment.beginTransaction();
    await payment.query("SELECT id FROM checkout_sessions WHERE id = ? FOR UPDATE", [session!.id]);
    mysqlPool.getConnection = async () => {
      expiryConnection = await getConnection.call(mysqlPool);
      await expiryConnection.query("SET SESSION innodb_lock_wait_timeout = 1");
      return expiryConnection;
    };
    await assert.rejects(module!.releaseExpiredCheckoutReservations(new Date()), (error: any) => {
      assert.equal(error.cause?.code ?? error.code, "ER_LOCK_WAIT_TIMEOUT", "MySQL must confirm an actual session-row lock wait");
      assert.match(error.query ?? error.cause?.sql, /select.*checkout_sessions.*for update/i,
        "expiry must wait at the initial locking read, before any stock writes");
      return true;
    });
    const [held] = await db.select().from(checkoutReservations)
      .where(eq(checkoutReservations.checkoutSessionId, session!.id));
    assert.equal(held.state, "reserved", "a blocked expiry performs no stock effect");
  } finally {
    mysqlPool.getConnection = getConnection;
    await payment.rollback();
    payment.release();
    // The connection has already been returned by Drizzle. Restore its session
    // setting on that connection before the next test uses the pool.
    if (expiryConnection) await expiryConnection.query("SET SESSION innodb_lock_wait_timeout = DEFAULT");
  }
  await module!.releaseExpiredCheckoutReservations(new Date());
  const [variant] = await db.select({ stockQty: productVariants.stockQty })
    .from(productVariants).where(eq(productVariants.id, ids.firstVariantId)).limit(1);
  assert.equal(variant?.stockQty, 10, "stock is restored exactly once across both paths");
  const reservations = await db.select().from(checkoutReservations)
    .where(eq(checkoutReservations.checkoutSessionId, session!.id));
  assert.equal(reservations.filter((row) => row.state === "released").length, 1,
    "the reservation is released once, never twice");
});

test("releaseExpiredCheckoutReservations restores stock only once", async () => {
  const module = await import("../../src/repositories/checkout/checkout-reservation.repository.js").catch(() => null);
  const ids = await getBaselineIds();
  const input = sessionInput(ids.firstVariantId);
  input.reservationExpiresAt = new Date(Date.now() - 1000);
  const session = await module?.createReservedCheckout(input);

  await module?.releaseExpiredCheckoutReservations(new Date());
  await module?.releaseExpiredCheckoutReservations(new Date());

  const [variant] = await db.select({ stockQty: productVariants.stockQty })
    .from(productVariants).where(eq(productVariants.id, ids.firstVariantId)).limit(1);
  const [checkout] = await db.select({ state: checkoutSessions.state })
    .from(checkoutSessions).where(eq(checkoutSessions.id, session?.id ?? -1)).limit(1);
  assert.equal(variant?.stockQty, 10);
  assert.equal(checkout?.state, "expired");
});
