import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";
import { db, mysqlPool } from "@capella/database/src/db";
import { checkoutSessions, orderReviewFlags, orders, paymentAttempts, paymobCallbackInbox, productVariants, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { createReservedCheckout, discoverExpiredSessionIds, releaseExpiredCheckoutReservations } from "../../src/modules/checkout/checkout-reservation.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { expirePendingCodOrders } from "../../src/modules/orders/order.repository.js";
import { resolveOrderReviewFlagRepo } from "../../src/modules/orders/order-review-flag.repository.js";
import { enqueueOrderDelivery } from "../../src/modules/shipping/shipping-dispatch.repository.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";
import { bostaDeliveryProviderFromEnvironment } from "../../src/modules/shipping/bosta/bosta-delivery.service.js";
import { deliveryEnvironment, deliveryRateIdentity } from "../helpers/bosta-delivery.js";
import { fixtureShippingService, selectedDestination, shippingBuyer } from "../helpers/checkout-shipping.js";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";

const paymobConfig = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
  hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true,
  intentionExpirationSeconds: 1800 as const };
// Amount 13229 is one variant plus 97.29 shipping, matching the fixture shipping service.
const paidDispatchTransaction = { id: 8801, order: { id: 9801 }, amount_cents: 13229, currency: "EGP", integration_id: 123,
  success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
  is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };

beforeEach(resetApiTestDatabase);

test("expiry does not release stock while a durably received success callback is still unprocessed", async () => {
  const ids = await getBaselineIds();
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "In Flight", phone: "+201012345678", email: "in-flight@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() - 1000),
    reservations: [{ variantId: ids.firstVariantId, qty: 2 }],
    initialAttempt: { merchantReference: "pi_in_flight", environment: "test", allowedIntegrationIds: [123],
      expiresAt: new Date(Date.now() + 60_000) }
  });
  // The callback was durably accepted (HMAC-verified) but its effects are not applied yet.
  // Releasing the reservation here would free stock the customer already paid for and
  // leave the eventual success with nothing to fulfil.
  const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
  await receivePaymobCallback({ callbackType: "transaction",
    transaction: { id: 7101, order: { id: 9501 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
      success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
      is_voided: false, has_parent_transaction: false, source_data: { type: "card" } } });
  await db.update(paymentAttempts).set({ paymobOrderId: "9501" })
    .where(eq(paymentAttempts.checkoutSessionId, session.id));

  await releaseExpiredCheckoutReservations(new Date());

  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(variant.stockQty, 8, "reserved stock stays held while payment evidence is in flight");
  const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, session.id));
  assert.equal(checkout.state, "payment_pending", "the session is held for the in-flight payment");
});

test("expiry releases stock normally once the queued callback has been fully processed", async () => {
  const ids = await getBaselineIds();
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Settled", phone: "+201012345678", email: "settled@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() - 1000),
    reservations: [{ variantId: ids.firstVariantId, qty: 2 }],
    initialAttempt: { merchantReference: "pi_settled", environment: "test", allowedIntegrationIds: [123],
      expiresAt: new Date(Date.now() + 60_000) }
  });
  await db.update(paymentAttempts).set({ paymobOrderId: "9502", status: "succeeded", paymobTransactionId: "7102" })
    .where(eq(paymentAttempts.checkoutSessionId, session.id));

  await releaseExpiredCheckoutReservations(new Date());

  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(variant.stockQty, 10, "stock returns once no unresolved payment evidence remains");
  const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, session.id));
  assert.equal(checkout.state, "expired");
});

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

test("checkout expiry worker denies 96-hour-old pending COD orders and restores their stock", async () => {
  const ids = await getBaselineIds();
  const created = await createOrderFromCheckout({
    fullName: "Abandoned COD", phone: "01012345678", email: "abandoned-cod@example.com", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
  }, { idempotencyKey: crypto.randomUUID(), now: new Date(Date.now() - 97 * 60 * 60 * 1000) });
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

const HOUR = 60 * 60 * 1000;
// Whole-second instants: the `cod_expires_at` datetime column stores no sub-second
// part, so sub-second creation times would make the deadline look skewed in tests.
const ago = (hours: number) => new Date(Math.floor((Date.now() - hours * HOUR) / 1000) * 1000);
const orderById = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];
const stockOf = async (variantId: number) =>
  (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0].stockQty;

async function createCodOrder(hoursAgo: number, email: string) {
  const ids = await getBaselineIds();
  const createdAt = ago(hoursAgo);
  const created = await createOrderFromCheckout({
    fullName: "Untouched Buyer", phone: "01012345678", email, governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
  }, { idempotencyKey: crypto.randomUUID(), now: createdAt });
  return { ids, orderId: created.id, createdAt };
}

async function createPaidOrder(hoursAgo: number, email: string) {
  const { ids, orderId, createdAt } = await createCodOrder(hoursAgo, email);
  await db.update(orders).set({ paymentMethod: "paymob", paymentStatus: "accepted",
    providerPaymentStatus: "succeeded", shippingSnapshot: null }).where(eq(orders.id, orderId));
  return { ids, orderId, createdAt };
}

test("the untouched deadline is order creation plus 96 hours", async () => {
  const { orderId, createdAt } = await createCodOrder(60, "deadline-96@example.test");
  // Asserted against the creation instant supplied to checkout, not the stored
  // `created_at` column: timestamp columns read back with a driver timezone
  // shift, while the deadline is stored as an exact instant.
  assert.equal((await orderById(orderId)).codExpiresAt!.getTime(), createdAt.getTime() + 96 * HOUR);
});

test("a 48-hour-old untouched COD order is still pending and keeps its stock", async () => {
  const { ids, orderId } = await createCodOrder(49, "still-pending-49@example.test");

  await expirePendingCodOrders(new Date());

  assert.equal((await orderById(orderId)).paymentStatus, "pending");
  assert.equal(await stockOf(ids.firstVariantId), 8);
});

test("the untouched deadline is fixed and never reset by repeated sweeps", async () => {
  const { orderId } = await createCodOrder(95, "fixed-deadline@example.test");
  const deadline = (await orderById(orderId)).codExpiresAt!.getTime();

  await expirePendingCodOrders(new Date());
  await expirePendingCodOrders(new Date());

  assert.equal((await orderById(orderId)).codExpiresAt!.getTime(), deadline);
  assert.equal((await orderById(orderId)).paymentStatus, "pending");
});

test("genuine processing stops untouched expiry for a COD order past the deadline", async () => {
  const { ids, orderId, createdAt } = await createCodOrder(97, "preparing-97@example.test");
  await db.update(orders).set({ shippingProcessingAtMs: createdAt.getTime() + 10 * 60 * 1000 })
    .where(eq(orders.id, orderId));

  await expirePendingCodOrders(new Date());

  assert.equal((await orderById(orderId)).paymentStatus, "pending");
  assert.equal(await stockOf(ids.firstVariantId), 8);
});

test("a pre-pickup address exception makes the original deadline apply again", async () => {
  const { ids, orderId, createdAt } = await createCodOrder(97, "address-blocked-97@example.test");
  await db.update(orders).set({ shippingProcessingAtMs: createdAt.getTime() + 10 * 60 * 1000,
    shippingAddressBlockedAtMs: createdAt.getTime() + 20 * 60 * 1000 }).where(eq(orders.id, orderId));

  await expirePendingCodOrders(new Date());

  assert.equal((await orderById(orderId)).paymentStatus, "denied");
  assert.equal(await stockOf(ids.firstVariantId), 10);
});

test("a confirmed pickup excludes the order from untouched expiry even past the deadline", async () => {
  const { ids, orderId, createdAt } = await createCodOrder(97, "picked-up-97@example.test");
  await db.update(orders).set({ shippingProcessingAtMs: createdAt.getTime() + 10 * 60 * 1000,
    shippingPickupAtMs: createdAt.getTime() + 30 * 60 * 1000 }).where(eq(orders.id, orderId));

  await expirePendingCodOrders(new Date());

  assert.equal((await orderById(orderId)).paymentStatus, "pending");
  assert.equal(await stockOf(ids.firstVariantId), 8);
});

test("a paid untouched order past the deadline is flagged for staff and is never refunded or restocked", async () => {
  const { ids, orderId } = await createPaidOrder(97, "paid-flag@example.test");

  await expirePendingCodOrders(new Date());

  const flags = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flagType, "untouched_paid");
  assert.equal(flags[0].status, "open");

  const order = await orderById(orderId);
  assert.equal(order.paymentStatus, "accepted");
  assert.equal(order.refundedAmountCents, 0);
  assert.equal(order.cancellationStatus, null);
  assert.equal(await stockOf(ids.firstVariantId), 8);
});

test("a paid order before the deadline or with genuine processing raises no untouched flag", async () => {
  const before = await createPaidOrder(60, "paid-before-deadline@example.test");
  const processing = await createPaidOrder(97, "paid-processing@example.test");
  const pickup = await createPaidOrder(97, "paid-pickup@example.test");
  await db.update(orders).set({ shippingProcessingAtMs: processing.createdAt.getTime() + 10 * 60 * 1000 })
    .where(eq(orders.id, processing.orderId));
  await db.update(orders).set({ shippingPickupAtMs: pickup.createdAt.getTime() + 30 * 60 * 1000 })
    .where(eq(orders.id, pickup.orderId));

  await expirePendingCodOrders(new Date());

  for (const { orderId } of [before, processing, pickup]) {
    assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId))).length, 0);
  }
  assert.equal((await orderById(processing.orderId)).paymentStatus, "accepted");
});

test("repeated sweeps raise the untouched paid flag only once and never re-raise a resolved flag", async () => {
  const { orderId } = await createPaidOrder(97, "paid-flag-once@example.test");

  await expirePendingCodOrders(new Date());
  await expirePendingCodOrders(new Date());
  assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId))).length, 1);

  const [flag] = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId));
  await resolveOrderReviewFlagRepo(flag.id);
  await expirePendingCodOrders(new Date());

  // The deadline is one fixed event, so an acknowledged alert stays acknowledged.
  const flags = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].status, "resolved");
  assert.equal((await db.select().from(orderReviewFlags)
    .where(and(eq(orderReviewFlags.orderId, orderId), eq(orderReviewFlags.status, "open")))).length, 0);
});

test("an untouched paid order keeps its original deadline across sweeps", async () => {
  const { orderId } = await createPaidOrder(97, "paid-fresh@example.test");
  const deadline = (await orderById(orderId)).codExpiresAt!.getTime();

  await expirePendingCodOrders(new Date());
  await expirePendingCodOrders(new Date());

  assert.equal((await orderById(orderId)).codExpiresAt!.getTime(), deadline);
});

const dispatchProvider = () => bostaDeliveryProviderFromEnvironment(deliveryEnvironment, async () => Response.json({ success: true,
  data: { trackingNumber: "5108002", state: { code: 10, value: "Pickup requested" } } }))!;

test("concurrent expiry sweeps raise only one untouched paid alert", async () => {
  const { orderId } = await createPaidOrder(97, "concurrent-paid-expiry@example.test");

  await Promise.all([expirePendingCodOrders(new Date()), expirePendingCodOrders(new Date())]);

  const flags = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId));
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flagType, "untouched_paid");
});

test("expiry rechecks processing recorded while it waits for the order lock", async () => {
  const { orderId, ids } = await createCodOrder(97, "processing-race@example.test");
  const connection = await mysqlPool.getConnection();
  let sweep: Promise<void> | undefined;
  try {
    await connection.beginTransaction();
    await connection.query("UPDATE orders SET shipping_processing_at_ms = ? WHERE id = ?", [Date.now(), orderId]);
    // Candidate discovery can still see the committed untouched state. Once the
    // lock is released, the sweep must use the newly committed processing state.
    sweep = expirePendingCodOrders(new Date());
    await new Promise(resolve => setTimeout(resolve, 100));
    await connection.commit();
    await sweep;
    assert.equal((await orderById(orderId)).paymentStatus, "pending");
    assert.equal(await stockOf(ids.firstVariantId), 8);
  } finally {
    await connection.rollback();
    connection.release();
    await sweep;
  }
});

for (const scenario of [
  { name: "denied COD", patch: { paymentStatus: "denied" as const } },
  { name: "paid COD", patch: { paymentStatus: "accepted" as const } },
  { name: "already-alerted paid", patch: { paymentMethod: "paymob" as const, paymentStatus: "accepted" as const }, flagStatus: "open" as const },
  { name: "acknowledged paid", patch: { paymentMethod: "paymob" as const, paymentStatus: "accepted" as const }, flagStatus: "resolved" as const },
  { name: "refunded paid", patch: { paymentMethod: "paymob" as const, paymentStatus: "accepted" as const, refundedAmountCents: 7000 } },
  { name: "processed paid", patch: { paymentMethod: "paymob" as const, paymentStatus: "accepted" as const, shippingProcessingAtMs: 1 } },
  { name: "picked-up paid", patch: { paymentMethod: "paymob" as const, paymentStatus: "accepted" as const, shippingPickupAtMs: 1 } }
]) {
  test(`a lock on a ${scenario.name} order cannot delay eligible COD expiry`, async () => {
    const skipped = await createCodOrder(97, "skipped-lock@example.test");
    await db.update(orders).set(scenario.patch).where(eq(orders.id, skipped.orderId));
    if ("flagStatus" in scenario) {
      await db.insert(orderReviewFlags).values({ orderId: skipped.orderId, flagType: "untouched_paid",
        status: scenario.flagStatus, reason: "The fixed deadline was already handled" });
    }
    const eligible = await createCodOrder(97, "eligible-lock@example.test");
    const connection = await mysqlPool.getConnection();
    let sweep: Promise<void> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await connection.beginTransaction();
      await connection.query("SELECT id FROM orders WHERE id = ? FOR UPDATE", [skipped.orderId]);
      sweep = expirePendingCodOrders(new Date());
      const finished = await Promise.race([
        sweep.then(() => true),
        new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 2000); })
      ]);
      assert.equal(finished, true, "expiry must finish while the ineligible order remains locked");
      assert.equal((await orderById(eligible.orderId)).paymentStatus, "denied");
    } finally {
      clearTimeout(timeout);
      await connection.rollback();
      connection.release();
      await sweep;
    }
  });
}

/**
 * A real paid order with its durable delivery intent, built through the actual Paymob path
 * (checkout -> paid callback) so the locked quote, payment method and untouched deadline are
 * exactly what production produces. This is the order shape the dispatch guard must judge.
 */
async function paidOrderWithDeliveryIntent(hours: number, email: string) {
  const ids = await getBaselineIds();
  const createdAt = ago(hours);
  // A prepaid quote collects no COD, so its rate identity is the prepaid one.
  const shippingService = fixtureShippingService(9729, (cod) => deliveryRateIdentity(cod, "prepaid"));
  const payload = { ...shippingBuyer, email, paymentMethod: "paymob" as const, shippingAddress: selectedDestination,
    items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const quote = await shippingService.quoteCheckout(payload, await priceCheckout(payload));
  await initiatePaymobCheckout({ config: paymobConfig, notificationUrl: "https://api.test/webhook",
    redirectionUrl: "https://test/result",
    payload: { ...payload, shippingQuoteId: quote.quoteId, expectedAmountCents: 13229 },
    shippingService, idempotencyKey: crypto.randomUUID(),
    createIntention: async () => ({ intentionId: "pi_dispatch", orderId: 9801, clientSecret: "s", checkoutUrl: "https://c" }) });
  const created = await processPaymobTransaction(paidDispatchTransaction);
  const orderId = created.orderId;
  assert.ok(orderId, `the paid callback must create the order (got ${created.outcome})`);
  // Age the real order creation so the sweep sees it as past the untouched deadline.
  await db.update(orders).set({ createdAt, codExpiresAt: new Date(createdAt.getTime() + 96 * HOUR) })
    .where(eq(orders.id, orderId));
  await db.transaction(tx => enqueueOrderDelivery(tx, orderId));
  const [order] = await db.select({ paymentAttemptId: orders.paymentAttemptId })
    .from(orders).where(eq(orders.id, orderId)).limit(1);
  const [attempt] = await db.select({ checkoutSessionId: paymentAttempts.checkoutSessionId })
    .from(paymentAttempts).where(eq(paymentAttempts.id, order!.paymentAttemptId ?? -1)).limit(1);
  return { ids, orderId, createdAt, sessionId: attempt!.checkoutSessionId };
}

test("the real dispatch worker ships an order carrying only the informational untouched alert", async () => {
  const { orderId, ids } = await paidOrderWithDeliveryIntent(97, "paid-alert-dispatch@example.test");

  await expirePendingCodOrders(new Date());
  const [flag] = await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.orderId, orderId));
  assert.equal(flag.flagType, "untouched_paid", "the informational alert must be raised");

  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) })
    .where(eq(shippingWorkItems.orderId, orderId));
  await runShippingDispatchOnce({ provider: dispatchProvider() });

  // O12: the worker must create the delivery rather than failing the job as undispatchable.
  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
  assert.equal(job.status, "succeeded", `expected a successful dispatch, got ${job.lastError}`);
  assert.equal(job.lastError, null);
  const [created] = await db.select().from(shipments).where(eq(shipments.orderId, orderId));
  assert.equal(created.trackingNumber, "5108002", "the delivery must actually be created");
  assert.equal(await stockOf(ids.firstVariantId), 9, "the untouched paid alert must not restock");
});

test("dispatch holds an order while refund evidence for its session is still unresolved", async () => {
  const { orderId, sessionId } = await paidOrderWithDeliveryIntent(97, "unresolved-refund-blocks@example.test");
  // A refund callback is durably received but not yet resolved. Handing this order to a
  // courier now would deliver goods to someone whose money is being returned, and the
  // refund may then be spent again. Dispatch must wait for the authenticated answer.
  const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
  // Only the provider order id is set here. The attempt keeps whatever status the paid
  // path actually left it at ('succeeded'), because forcing it back to 'pending' made this
  // test exercise a shape that does not occur in production: a refund never arrives
  // against an open attempt.
  const [before] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, sessionId));
  assert.equal(before.status, "succeeded", "the refund must arrive against a settled attempt");
  await db.update(paymentAttempts).set({ paymobOrderId: "9701" })
    .where(eq(paymentAttempts.checkoutSessionId, sessionId));
  await receivePaymobCallback({ callbackType: "transaction", transaction: {
    id: 7301, order: { id: 9701 }, amount_cents: 13229, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: true,
    is_voided: false, has_parent_transaction: false, source_data: { type: "card" } } });

  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) })
    .where(eq(shippingWorkItems.orderId, orderId));
  await runShippingDispatchOnce({ provider: dispatchProvider() });

  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
  assert.equal(job.lastError, "AWAITING_PAYMENT_EVIDENCE",
    "unresolved refund evidence must hold the shipment, retryably");
  assert.equal((await db.select().from(shipments).where(eq(shipments.orderId, orderId))).length, 0,
    "nothing is handed to the courier while the refund is unresolved");
});

test("dispatch holds a PAID order whose refund evidence arrives after the attempt succeeded", async () => {
  const { orderId, sessionId } = await paidOrderWithDeliveryIntent(97, "late-refund-blocks@example.test");
  // The attempt is genuinely succeeded - the order was paid and created. Only now does a
  // refund callback land, durably received but not yet resolved. Handing this order to a
  // courier now would deliver goods to someone whose money is being returned.
  //
  // This is the case that a guard scoped to "created/pending" attempts misses entirely,
  // because a refund normally arrives hours after the payment that it reverses.
  const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
  const [attempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, sessionId));
  assert.equal(attempt.status, "succeeded", "the paid fixture must leave the attempt succeeded");
  await db.update(paymentAttempts).set({ paymobOrderId: "9702" })
    .where(eq(paymentAttempts.checkoutSessionId, sessionId));
  await receivePaymobCallback({ callbackType: "transaction", transaction: {
    id: 7302, order: { id: 9702 }, amount_cents: 13229, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: true,
    is_voided: false, has_parent_transaction: false, source_data: { type: "card" } } });

  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) })
    .where(eq(shippingWorkItems.orderId, orderId));
  await runShippingDispatchOnce({ provider: dispatchProvider() });

  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
  assert.equal(job.lastError, "AWAITING_PAYMENT_EVIDENCE",
    "an unresolved refund on a paid attempt must still hold the shipment");
  assert.equal((await db.select().from(shipments).where(eq(shipments.orderId, orderId))).length, 0,
    "a refund that arrives after payment must still stop the parcel leaving");
});

test("expiry discovery does not spend its batch on sessions that are only held", async () => {
  // A session held by unresolved payment evidence is correctly skipped under its lock -
  // but it must not CONSUME a discovery slot. If held sessions occupy the batch, an
  // eligible session behind them is never examined and its stock is never released, so
  // the sweep silently stops making progress while held sessions pile up in front of it.
  //
  // The batch size is deliberately 2 here, not the production 50: starvation is a
  // ratio problem, and testing it at production scale would need 51 fixtures to prove
  // the same thing.
  const held: number[] = [];
  // The held ones expire EARLIER, so they take the first discovery slots and can push the
  // eligible session out of the batch. That ordering is the whole point of the test.
  for (let index = 0; index < 2; index += 1) {
    held.push(await createExpiredHeldSession(`starved-held-${index}@example.test`, 8100 + index, true, 120_000 + index * 1000));
  }
  const eligible = await createExpiredHeldSession("starved-eligible@example.test", 8199, false, 1000);

  const discovered = await discoverExpiredSessionIds(new Date(), 2);
  assert.ok(discovered.includes(eligible),
    `the eligible session must survive discovery behind held ones (discovered ${discovered.length})`);

  await releaseExpiredCheckoutReservations(new Date());

  const [released] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, eligible));
  assert.equal(released.state, "expired",
    "an eligible session behind held ones must still be released in the same sweep");
  for (const sessionId of held) {
    const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId));
    assert.equal(session.state, "payment_pending", "a held session must not be released");
  }
});

/**
 * An already-expired checkout session, optionally holding unresolved payment evidence so
 * it is skipped under its own lock.
 */
async function createExpiredHeldSession(email: string, paymobOrderId: number, held = true, expiryOffsetMs = 60_000, qty = 1) {
  const ids = await getBaselineIds();
  const created = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Starved", phone: "+201012345678", email,
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    // The larger the offset, the earlier this session expired, so it sorts ahead of the
    // others in discovery order.
    reservationExpiresAt: new Date(Date.now() - expiryOffsetMs),
    reservations: qty > 0 ? [{ variantId: ids.firstVariantId, qty }] : [],
    initialAttempt: { merchantReference: `pi_${paymobOrderId}`, environment: "test", allowedIntegrationIds: [123],
      expiresAt: new Date(Date.now() - 1000) }
  });
  if (held) {
    const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
    await db.update(paymentAttempts).set({ paymobOrderId: String(paymobOrderId) })
      .where(eq(paymentAttempts.checkoutSessionId, created.id));
    await receivePaymobCallback({ callbackType: "transaction",
      transaction: { id: paymobOrderId + 5000, order: { id: paymobOrderId }, amount_cents: 3500, currency: "EGP",
        integration_id: 123, success: true, pending: false, is_live: false, is_auth: false,
        is_capture: false, is_refunded: false, is_voided: false, has_parent_transaction: false,
        source_data: { type: "card" } } });
  }
  return created.id;
}

test("expiry discovery is not starved by held sessions even when history dwarfs the batch", async () => {
  // The exclusion was computed from a CAPPED scan of all payment attempts. Once history
  // exceeded that cap, held sessions fell outside it and stopped being excluded, so they
  // could occupy the earliest batch slots indefinitely and eligible sessions behind them
  // were never examined - stock never released, sweep silently idle.
  //
  // Scoping the evidence lookup to the actual candidates bounds the relevant input by the
  // batch instead of by total history. The history here is deliberately larger than any
  // fixed cap a candidate-scoped implementation would need.
  const held: number[] = [];
  for (let index = 0; index < 2; index += 1) {
    held.push(await createExpiredHeldSession(`f7-held-${index}@example.test`, 9600 + index, true, 240_000 + index * 1000));
  }
  const eligible = await createExpiredHeldSession("f7-eligible@example.test", 9699, false, 1000);

  // Historical held sessions, all expiring EARLIER than the eligible one, pushing total
  // history past the 5,000-row cap the previous implementation relied on and filling more
  // than the over-fetch window. They reserve no stock - they exist purely as history.
  for (let index = 0; index < 100; index += 1) {
    await createExpiredHeldSession(`f7-history-${index}@example.test`, 20_000 + index, true, 300_000 + index, 0);
  }

  const discovered = await discoverExpiredSessionIds(new Date(), 2);
  assert.ok(discovered.includes(eligible),
    `an eligible session behind held ones must survive discovery (got ${discovered.length})`);
});

test("a temporary evidence hold resumes automatically once the evidence resolves", async () => {
  // A refund still being verified is a TEMPORARY condition. Writing `failed` made the
  // stranded order depend on a member of staff pressing retry by hand, and the projections
  // treat this error as an expected stop, so nothing surfaces it as needing attention.
  const { orderId, sessionId } = await paidOrderWithDeliveryIntent(97, "hold-recovers@example.test");
  const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
  await db.update(paymentAttempts).set({ paymobOrderId: "9703" })
    .where(eq(paymentAttempts.checkoutSessionId, sessionId));
  await receivePaymobCallback({ callbackType: "transaction", transaction: {
    id: 7303, order: { id: 9703 }, amount_cents: 13229, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
    is_voided: false, has_parent_transaction: false, source_data: { type: "card" } } });
  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) })
    .where(eq(shippingWorkItems.orderId, orderId));
  await runShippingDispatchOnce({ provider: dispatchProvider() });

  const [held] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
  assert.notEqual(held.status, "failed",
    "a temporary evidence hold must not permanently fail the delivery job");

  // The payment evidence resolves: the inbox row is marked processed.
  await db.update(paymobCallbackInbox).set({ processingStatus: "processed" });
  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) })
    .where(eq(shippingWorkItems.orderId, orderId));
  await runShippingDispatchOnce({ provider: dispatchProvider() });

  const [after] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
  assert.equal(after.status, "succeeded",
    "once the evidence resolves the order must dispatch without staff intervention");
  assert.equal((await db.select().from(shipments).where(eq(shipments.orderId, orderId))).length, 1);
});

test("the real dispatch worker still refuses an order carrying a safety flag", async () => {
  const { orderId } = await paidOrderWithDeliveryIntent(97, "safety-flag-blocks@example.test");
  await db.insert(orderReviewFlags).values({ orderId, flagType: "custody_review", reason: "Custody is unverified" });

  await db.update(shippingWorkItems).set({ nextAttemptAt: new Date(Date.now() - 2000) })
    .where(eq(shippingWorkItems.orderId, orderId));
  await runShippingDispatchOnce({ provider: dispatchProvider() });

  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
  assert.equal(job.status, "failed", "a safety flag must still hold the shipment");
  assert.equal(job.lastError, "ORDER_NOT_DISPATCHABLE");
  assert.equal((await db.select().from(shipments).where(eq(shipments.orderId, orderId))).length, 0);
});
