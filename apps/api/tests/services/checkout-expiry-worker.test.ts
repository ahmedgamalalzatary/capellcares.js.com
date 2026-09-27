import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, orderReviewFlags, orders, paymentAttempts, productVariants, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { createReservedCheckout, releaseExpiredCheckoutReservations } from "../../src/repositories/checkout/checkout-reservation.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { expirePendingCodOrders } from "../../src/repositories/order.repository.js";
import { resolveOrderReviewFlagRepo } from "../../src/repositories/order-review-flag.repository.js";
import { enqueueOrderDelivery } from "../../src/repositories/shipping-dispatch.repository.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";
import { bostaDeliveryProviderFromEnvironment } from "../../src/modules/shipping/bosta/bosta-delivery.service.js";
import { deliveryEnvironment, deliveryRateIdentity } from "../helpers/bosta-delivery.js";
import { fixtureShippingService, selectedDestination, shippingBuyer } from "../helpers/checkout-shipping.js";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";

const paymobConfig = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
  hmacSecret: "hmac", enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true,
  intentionExpirationSeconds: 1800 as const };
// Amount 13229 is one variant plus 97.29 shipping, matching the fixture shipping service.
const paidDispatchTransaction = { id: 8801, order: { id: 9801 }, amount_cents: 13229, currency: "EGP", integration_id: 123,
  success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
  is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };

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
  return { ids, orderId, createdAt };
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
