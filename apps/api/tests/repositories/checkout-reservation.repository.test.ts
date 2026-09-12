import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
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
