import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { createReservedCheckout, releaseExpiredCheckoutReservations } from "../../src/repositories/checkout/checkout-reservation.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

beforeEach(resetApiTestDatabase);

test("checkout expiry worker restores an abandoned reservation without a customer request", async () => {
  const module = await import("../../src/modules/checkout/checkout-expiry-worker.js").catch(() => null);
  const ids = await getBaselineIds();
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Abandoned", phone: "+201012345678", email: "abandoned@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() - 1000), reservations: [{ variantId: ids.firstVariantId, qty: 2 }]
  });
  const stop = module?.startCheckoutExpiryWorker({ intervalMs: 20 });
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
    const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, session.id));
    assert.equal(variant.stockQty, 10);
    assert.equal(checkout.state, "expired");
  } finally {
    stop?.();
  }
});

test("expiry flags an early refunded attempt for manual reconciliation", async () => {
  const ids = await getBaselineIds();
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Early refund", phone: "+201012345678", email: "early-expiry@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() - 1000), reservations: [{ variantId: ids.firstVariantId, qty: 1 }],
    initialAttempt: { merchantReference: `ref_${crypto.randomUUID()}`, environment: "test",
      allowedIntegrationIds: [123], expiresAt: new Date(Date.now() - 1000) }
  });
  await db.update(paymentAttempts).set({ earlyRefundAmountCents: 1200, status: "pending",
    paymobTransactionId: "tx_early_expiry" }).where(eq(paymentAttempts.checkoutSessionId, session.id));
  await releaseExpiredCheckoutReservations(new Date());
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  assert.equal(attempt.status, "reconciliation_required");
});
