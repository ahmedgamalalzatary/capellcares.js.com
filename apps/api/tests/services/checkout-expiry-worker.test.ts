import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { createReservedCheckout, releaseExpiredCheckoutReservations } from "../../src/repositories/checkout/checkout-reservation.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { createOrderFromCheckout } from "../../src/modules/orders/orders.service.js";

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

test("expiry makes ordinary open payment attempts terminal", async () => {
  const ids = await getBaselineIds();
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Expired attempt", phone: "+201012345678", email: "terminal-expiry@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() - 1000), reservations: [{ variantId: ids.firstVariantId, qty: 1 }],
    initialAttempt: { merchantReference: `ref_${crypto.randomUUID()}`, environment: "test",
      allowedIntegrationIds: [123], expiresAt: new Date(Date.now() - 1000) }
  });
  await db.update(paymentAttempts).set({ status: "pending" }).where(eq(paymentAttempts.checkoutSessionId, session.id));

  await releaseExpiredCheckoutReservations(new Date());

  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  assert.equal(attempt.status, "expired");
  assert.equal(attempt.failureCode, "RESERVATION_EXPIRED");
});

test("expiry preserves a payment attempt that is already terminal", async () => {
  const ids = await getBaselineIds();
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Failed attempt", phone: "+201012345678", email: "failed-expiry@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() - 1000), reservations: [{ variantId: ids.firstVariantId, qty: 1 }],
    initialAttempt: { merchantReference: `ref_${crypto.randomUUID()}`, environment: "test",
      allowedIntegrationIds: [123], expiresAt: new Date(Date.now() - 1000) }
  });
  await db.update(paymentAttempts).set({ status: "failed", failureCode: "PROVIDER_DECLINED" })
    .where(eq(paymentAttempts.checkoutSessionId, session.id));

  await releaseExpiredCheckoutReservations(new Date());

  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  assert.equal(attempt.status, "failed");
  assert.equal(attempt.failureCode, "PROVIDER_DECLINED");
});

test("checkout expiry worker denies 48-hour-old pending COD orders and restores their stock", async () => {
  const ids = await getBaselineIds();
  const created = await createOrderFromCheckout({
    fullName: "Abandoned COD", phone: "01012345678", email: "abandoned-cod@example.com", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
  }, { idempotencyKey: crypto.randomUUID(), now: new Date(Date.now() - 49 * 60 * 60 * 1000) });
  const { startCheckoutExpiryWorker } = await import("../../src/modules/checkout/checkout-expiry-worker.js");

  const stop = startCheckoutExpiryWorker({ intervalMs: 20 });
  try {
    await new Promise((resolve) => setTimeout(resolve, 120));
  } finally {
    stop();
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(order.paymentStatus, "denied");
  assert.equal(variant.stockQty, 10);
});
