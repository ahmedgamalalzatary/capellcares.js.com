import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, orderItems, orders, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { releaseExpiredCheckoutReservations } from "../../src/repositories/checkout/checkout-reservation.repository.js";

beforeEach(resetApiTestDatabase);

test("initiatePaymobCheckout reserves stock and persists provider IDs without creating an order", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js").catch(() => null);
  const ids = await getBaselineIds();
  const now = new Date("2026-09-11T12:00:00Z");
  const result = await module?.initiatePaymobCheckout({
    payload: {
      fullName: "Test Customer", phone: "01012345678", email: "test@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1",
      buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
    },
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    now,
    config: {
      mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800
    },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({
      intentionId: "pi_test_abc", orderId: 9001, clientSecret: "client_secret",
      checkoutUrl: "https://eg.checkout.paymob.com/?publicKey=public&clientSecret=client_secret"
    })
  });

  const [attempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobIntentionId, "pi_test_abc")).limit(1);
  const [session] = await db.select().from(checkoutSessions)
    .where(eq(checkoutSessions.id, attempt?.checkoutSessionId ?? -1)).limit(1);
  const [variant] = await db.select({ stockQty: productVariants.stockQty }).from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId)).limit(1);

  assert.equal(result?.kind, "paymob_redirect");
  assert.equal(result?.checkoutUrl, "https://eg.checkout.paymob.com/?publicKey=public&clientSecret=client_secret");
  assert.equal(attempt?.paymobOrderId, "9001");
  assert.equal(attempt?.status, "pending");
  assert.equal(session?.shippingAmountCents, 0);
  assert.equal(session?.reservationExpiresAt.toISOString(), "2026-09-11T12:30:00.000Z");
  assert.equal(variant?.stockQty, 8);
  assert.equal((await db.select().from(orders)).length, 0);
});

test("initiatePaymobCheckout reuses a completed initiation for the same idempotency key", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js").catch(() => null);
  const ids = await getBaselineIds();
  let networkCalls = 0;
  const input = {
    payload: {
      fullName: "Replay Customer", phone: "01012345678", email: "replay@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 2 }]
    },
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    now: new Date("2026-09-11T12:00:00Z"),
    config: {
      mode: "test" as const, baseUrl: "https://accept.paymob.com" as const, secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card" as const, integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 as const
    },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => {
      networkCalls += 1;
      return { intentionId: "pi_test_replay", orderId: 9002, clientSecret: "replay_secret",
        checkoutUrl: "https://eg.checkout.paymob.com/?publicKey=public&clientSecret=replay_secret" };
    }
  };

  const first = await module?.initiatePaymobCheckout(input);
  const second = await module?.initiatePaymobCheckout(input);
  const [variant] = await db.select({ stockQty: productVariants.stockQty }).from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId)).limit(1);

  assert.deepEqual(second, first);
  assert.equal(networkCalls, 1);
  assert.equal(variant?.stockQty, 8);
  assert.equal((await db.select().from(checkoutSessions)).length, 1);
});

test("processPaymobTransaction creates one paid order and finalizes reserved stock", async () => {
  const checkoutModule = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const webhookModule = await import("../../src/modules/payments/paymob/paymob-transaction.service.js").catch(() => null);
  const ids = await getBaselineIds();
  await checkoutModule.initiatePaymobCheckout({
    payload: {
      fullName: "Paid Customer", phone: "01012345678", email: "paid@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }]
    },
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
    config: {
      mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
      enabledMethods: [{ method: "card", integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800
    },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_test_paid", orderId: 9003, clientSecret: "paid_secret", checkoutUrl: "https://checkout" })
  });
  const transaction = {
    id: 7001, order: { id: 9003 }, amount_cents: 7000, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, is_standalone_payment: true,
    source_data: { type: "card", pan: "1234", sub_type: "MasterCard" }
  };

  const first = await webhookModule?.processPaymobTransaction(transaction);
  const second = await webhookModule?.processPaymobTransaction(transaction);
  const createdOrders = await db.select().from(orders).where(eq(orders.paymentAttemptId, first?.paymentAttemptId ?? -1));
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, first?.orderId ?? -1));
  const [reservation] = await db.select().from(checkoutReservations)
    .where(eq(checkoutReservations.checkoutSessionId, first?.checkoutSessionId ?? -1)).limit(1);
  const [variant] = await db.select({ stockQty: productVariants.stockQty }).from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId)).limit(1);

  assert.equal(first?.outcome, "succeeded");
  assert.equal(second?.orderId, first?.orderId);
  assert.equal(createdOrders.length, 1);
  assert.equal(createdOrders[0]?.providerPaymentStatus, "succeeded");
  assert.equal(createdOrders[0]?.paymentStatus, "accepted");
  assert.equal(items.length, 1);
  assert.equal(reservation?.state, "finalized");
  assert.equal(variant?.stockQty, 8);
});

test("initiatePaymobCheckout rejects reusing an idempotency key for a different cart", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  const base = {
    payload: { fullName: "Conflict", phone: "01012345678", email: "conflict@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob" as const,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "55555555-5555-4555-8555-555555555555",
    config: { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const, secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true,
      intentionExpirationSeconds: 1800 as const },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_conflict", orderId: 9004, clientSecret: "conflict_secret", checkoutUrl: "https://checkout" })
  };
  await module.initiatePaymobCheckout(base);
  await assert.rejects(module.initiatePaymobCheckout({
    ...base,
    payload: { ...base.payload, items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }] }
  }), /idempotency key belongs to a different checkout/i);
});

test("initiatePaymobCheckout never reopens a completed payment on idempotent replay", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const input = {
    payload: { fullName: "Completed", phone: "01012345678", email: "completed@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob" as const,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 2 }] },
    idempotencyKey: "66666666-6666-4666-8666-666666666666",
    config: { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const, secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card" as const, integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 as const },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_completed", orderId: 9010, clientSecret: "completed_secret", checkoutUrl: "https://checkout" })
  };
  await initiatePaymobCheckout(input);
  await processPaymobTransaction({ id: 7010, order: { id: 9010 }, amount_cents: 7000, currency: "EGP",
    integration_id: 123, success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" } });

  await assert.rejects(initiatePaymobCheckout(input), /checkout already completed/i);
});

test("initiatePaymobCheckout never reopens an expired reservation on idempotent replay", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  const input = {
    payload: { fullName: "Expired", phone: "01012345678", email: "expired@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob" as const,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "77777777-7777-4777-8777-777777777777",
    config: { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const, secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card" as const, integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 as const },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_expired", orderId: 9011, clientSecret: "expired_secret", checkoutUrl: "https://checkout" })
  };
  await initiatePaymobCheckout(input);
  await db.update(checkoutSessions).set({ state: "expired" }).where(eq(checkoutSessions.idempotencyKey, input.idempotencyKey));

  await assert.rejects(initiatePaymobCheckout(input), /checkout is no longer payable/i);
});

test("processPaymobTransaction accepts the wallet integration offered alongside cards", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Wallet Customer", phone: "01012345678", email: "wallet@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "88888888-8888-4888-8888-888888888888",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }, { method: "wallet", integrationId: 456 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_wallet", orderId: 9012, clientSecret: "wallet_secret", checkoutUrl: "https://checkout" })
  });
  const result = await processPaymobTransaction({ id: 7012, order: { id: 9012 }, amount_cents: 3500,
    currency: "EGP", integration_id: 456, success: true, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "wallet" } });
  assert.equal(result.outcome, "succeeded");
});

test("initiatePaymobCheckout sends the processed callback when wallets are offered", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  let notificationUrl: string | undefined;
  await initiatePaymobCheckout({
    payload: { fullName: "Mixed Methods", phone: "01012345678", email: "mixed@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "99999999-9999-4999-8999-999999999999",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }, { method: "wallet", integrationId: 456 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async (request) => {
      notificationUrl = request.notificationUrl;
      return { intentionId: "pi_mixed", orderId: 9013, clientSecret: "mixed_secret", checkoutUrl: "https://checkout" };
    }
  });
  assert.equal(notificationUrl, "https://api.capellacares.com/api/v1/payments/paymob/webhook");
});

test("initiatePaymobCheckout gives Paymob a return URL that identifies the checkout", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  let providerReturnUrl: string | undefined;
  const result = await initiatePaymobCheckout({
    payload: { fullName: "Return Customer", phone: "01012345678", email: "return@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "19191919-1919-4919-8919-191919191919",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result?campaign=fall",
    createIntention: async (request) => {
      providerReturnUrl = request.redirectionUrl;
      return { intentionId: "pi_return", orderId: 9019, clientSecret: "return_secret", checkoutUrl: "https://checkout" };
    }
  });

  assert.equal(providerReturnUrl,
    `https://capellacares.com/checkout/payment-result?campaign=fall&checkoutId=${encodeURIComponent(result.checkoutId)}`);
});

test("processPaymobTransaction matches an early callback by merchant reference before the Paymob order ID is saved", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  let earlyOutcome: string | undefined;

  await initiatePaymobCheckout({
    payload: { fullName: "Fast payer", phone: "01012345678", email: "fast@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "12121212-1212-4212-8212-121212121212",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async (request) => {
      const result = await processPaymobTransaction({ id: 7112, order: { id: 9112, merchant_order_id: request.specialReference },
        amount_cents: 3500, currency: "EGP", integration_id: 123, success: true, pending: false, is_live: false,
        is_auth: false, is_capture: false, is_refunded: false, is_voided: false, has_parent_transaction: false,
        source_data: { type: "card" } });
      earlyOutcome = result.outcome;
      return { intentionId: "pi_fast", orderId: 9112, clientSecret: "fast_secret", checkoutUrl: "https://checkout" };
    }
  });

  assert.equal(earlyOutcome, "succeeded");
  assert.equal((await db.select().from(orders).where(eq(orders.email, "fast@example.com"))).length, 1);
});

test("processPaymobTransaction records a matching decline without creating an order or releasing the reservation", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Declined", phone: "01012345678", email: "declined@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_declined", orderId: 9014, clientSecret: "declined_secret", checkoutUrl: "https://checkout" })
  });
  const result = await processPaymobTransaction({ id: 7014, order: { id: 9014 }, amount_cents: 3500,
    currency: "EGP", integration_id: 123, success: false, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" } });
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, "9014"));
  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, attempt.checkoutSessionId));
  const [reservation] = await db.select().from(checkoutReservations).where(eq(checkoutReservations.checkoutSessionId, session.id));
  assert.equal(result.outcome, "failed");
  assert.equal(attempt.status, "failed");
  assert.equal(session.state, "payment_pending");
  assert.equal(reservation.state, "reserved");
  assert.equal((await db.select().from(orders)).length, 0);
});

test("retryPaymobCheckout allocates one new attempt against the existing reservation after a decline", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const initial = await module.initiatePaymobCheckout({
    payload: { fullName: "Retry Customer", phone: "01012345678", email: "retry@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_retry_first", orderId: 9015, clientSecret: "first_secret", checkoutUrl: "https://checkout/first" })
  });
  await processPaymobTransaction({ id: 7015, order: { id: 9015 }, amount_cents: 3500,
    currency: "EGP", integration_id: 123, success: false, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" } });
  let retryReturnUrl: string | undefined;
  const result = await module.retryPaymobCheckout({ checkoutId: initial.checkoutId, config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async (request) => {
      retryReturnUrl = request.redirectionUrl;
      return { intentionId: "pi_retry_second", orderId: 9016, clientSecret: "second_secret", checkoutUrl: "https://checkout/second" };
    } });
  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.publicId, initial.checkoutId));
  const attempts = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(result.checkoutUrl, "https://checkout/second");
  assert.equal(retryReturnUrl,
    `https://capellacares.com/checkout/payment-result?checkoutId=${encodeURIComponent(initial.checkoutId)}`);
  assert.equal(session.attemptCount, 2);
  assert.equal(attempts.length, 2);
  assert.equal(variant.stockQty, 9);
  await assert.rejects(module.retryPaymobCheckout({ checkoutId: initial.checkoutId, config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => { throw new Error("Should not create a third intention"); } }),
  /previous payment attempt has not failed/i);
});

test("initiatePaymobCheckout replays the latest attempt for an idempotency key", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";
  const payload = { fullName: "Replay Latest", phone: "01012345678", email: "replay-latest@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const idempotencyKey = "56565656-5656-4656-8656-565656565656";
  const first = await module.initiatePaymobCheckout({
    payload, idempotencyKey, now: new Date("2026-09-11T12:00:00Z"), config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_replay_first", orderId: 9101,
      clientSecret: "first_secret", checkoutUrl: "https://checkout/first" })
  });
  await processPaymobTransaction({ id: 7101, order: { id: 9101 }, amount_cents: 3500,
    currency: "EGP", integration_id: 123, success: false, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" } });
  await module.retryPaymobCheckout({ checkoutId: first.checkoutId, config, notificationUrl, redirectionUrl,
    now: new Date("2026-09-11T12:01:00Z"),
    createIntention: async () => ({ intentionId: "pi_replay_second", orderId: 9102,
      clientSecret: "second_secret", checkoutUrl: "https://checkout/second" }) });

  const replayed = await module.initiatePaymobCheckout({
    payload, idempotencyKey, now: new Date("2026-09-11T12:02:00Z"), config, notificationUrl, redirectionUrl,
    createIntention: async () => { throw new Error("Should not create a new intention for a replay"); }
  });

  assert.ok(replayed.checkoutUrl.includes("second_secret"),
    `expected the latest attempt's secret, got ${replayed.checkoutUrl}`);
});

test("initiatePaymobCheckout releases the reservation and retries after intention creation fails", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";
  const payload = { fullName: "Provider Down", phone: "01012345678", email: "provider-down@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const idempotencyKey = "78787878-7878-4787-8787-787878787878";

  await assert.rejects(
    module.initiatePaymobCheckout({ payload, idempotencyKey, now: new Date("2026-09-11T12:00:00Z"),
      config, notificationUrl, redirectionUrl,
      createIntention: async () => { throw new PaymobProviderError("Paymob intention request failed with status 400", { status: 400 }); },
      lookupIntention: async () => null }),
    /failed with status 400/
  );

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const reservations = await db.select().from(checkoutReservations).where(eq(checkoutReservations.checkoutSessionId, session.id));
  const [released] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(attempt.status, "failed");
  assert.equal(session.state, "failed");
  assert.ok(reservations.every((reservation) => reservation.state === "released"));
  assert.equal(released.stockQty, 10);

  const recovered = await module.initiatePaymobCheckout({ payload, idempotencyKey,
    now: new Date("2026-09-11T12:01:00Z"), config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_after_failure", orderId: 9103,
      clientSecret: "recovered_secret", checkoutUrl: "https://checkout/recovered" }) });
  assert.equal(recovered.checkoutUrl, "https://checkout/recovered");
  const [reserved] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(reserved.stockQty, 9);
});

test("initiatePaymobCheckout fails the attempt when create is a definitive rejection even if lookup throws", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const idempotencyKey = "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4";
  const payload = { fullName: "Lookup Throw", phone: "01012345678", email: "lookup-throw@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };

  await assert.rejects(module.initiatePaymobCheckout({
    payload, idempotencyKey, now: new Date("2026-09-11T12:00:00Z"), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => { throw new PaymobProviderError("Paymob intention request failed with status 400", { status: 400 }); },
    lookupIntention: async () => { throw new PaymobProviderError("Paymob intention lookup timed out"); }
  }), /failed with status 400/);

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(attempt.status, "failed");
  assert.equal(session.state, "failed");
  assert.equal(variant.stockQty, 10);
});

test("initiatePaymobCheckout keeps stock held after an ambiguous intention failure", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const payload = { fullName: "Ambiguous Fail", phone: "01012345678", email: "ambiguous@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const idempotencyKey = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";

  await assert.rejects(module.initiatePaymobCheckout({
    payload, idempotencyKey, now: new Date("2026-09-11T12:00:00Z"), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => { throw new PaymobProviderError("Paymob intention request timed out"); },
    lookupIntention: async () => { throw new PaymobProviderError("Paymob intention lookup timed out"); }
  }), /timed out/i);

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(attempt.status, "created");
  assert.equal(session.state, "payment_pending");
  assert.equal(variant.stockQty, 9);
});

test("initiatePaymobCheckout recovers a provider intention found by special reference after a create timeout", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  let specialReference = "";
  const result = await module.initiatePaymobCheckout({
    payload: { fullName: "Recovered Intention", phone: "01012345678", email: "recovered-intention@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2",
    now: new Date("2026-09-11T12:00:00Z"), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async (request) => {
      specialReference = request.specialReference;
      throw new PaymobProviderError("Paymob intention request timed out");
    },
    lookupIntention: async (request) => {
      assert.equal(request.specialReference, specialReference);
      return { intentionId: "pi_recovered_lookup", orderId: 9201, clientSecret: "lookup_secret",
        checkoutUrl: "https://eg.checkout.paymob.com/?publicKey=public&clientSecret=lookup_secret" };
    }
  });
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobIntentionId, "pi_recovered_lookup"));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(result.kind, "paymob_redirect");
  assert.ok(result.checkoutUrl.includes("lookup_secret"));
  assert.equal(attempt?.paymobOrderId, "9201");
  assert.equal(attempt?.status, "pending");
  assert.equal(variant.stockQty, 9);
});

test("initiatePaymobCheckout does not recycle a failed attempt for a different cart on the same idempotency key", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";
  const idempotencyKey = "c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3";
  const payload = { fullName: "Reuse Guard", phone: "01012345678", email: "reuse-guard@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };

  await assert.rejects(module.initiatePaymobCheckout({
    payload, idempotencyKey, config, notificationUrl, redirectionUrl,
    createIntention: async () => { throw new PaymobProviderError("Paymob intention request failed with status 400", { status: 400 }); },
    lookupIntention: async () => null
  }), /failed with status 400/);
  const [original] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));

  await assert.rejects(module.initiatePaymobCheckout({
    payload: { ...payload, items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }] },
    idempotencyKey, config, notificationUrl, redirectionUrl,
    createIntention: async () => { throw new Error("Should not start a different checkout"); }
  }), /idempotency key belongs to a different checkout/i);

  const sessions = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, original.id);
  assert.equal(sessions[0].state, "failed");
});

test("processPaymobTransaction flags a paid checkout for reconciliation after its stock was released", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Late Payment", phone: "01012345678", email: "late@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    now: new Date("2026-09-11T12:00:00Z"),
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_late", orderId: 9017, clientSecret: "late_secret", checkoutUrl: "https://checkout" })
  });
  await releaseExpiredCheckoutReservations(new Date("2026-09-11T12:31:00Z"));
  const result = await processPaymobTransaction({ id: 7017, order: { id: 9017 }, amount_cents: 3500,
    currency: "EGP", integration_id: 123, success: true, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" } });
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, "9017"));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(result.outcome, "reconciliation_required");
  assert.equal(attempt.status, "reconciliation_required");
  assert.equal(attempt.paymobTransactionId, "7017");
  assert.equal(variant.stockQty, 10);
  assert.equal((await db.select().from(orders)).length, 0);
});

test("initiatePaymobCheckout does not return a payment link after its reservation is released", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  await assert.rejects(initiatePaymobCheckout({
    payload: { fullName: "Expired During Request", phone: "01012345678", email: "during@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    now: new Date("2026-09-11T12:00:00Z"),
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => {
      await releaseExpiredCheckoutReservations(new Date("2026-09-11T12:31:00Z"));
      return { intentionId: "pi_during", orderId: 9018, clientSecret: "during_secret", checkoutUrl: "https://checkout" };
    }
  }), /checkout is no longer payable/i);
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobIntentionId, "pi_during"));
  assert.equal(attempt?.paymobOrderId, "9018");
});

test("processPaymobTransaction reflects a full dashboard refund without restocking the order", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Refunded", phone: "01012345678", email: "refunded@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_refunded", orderId: 9019, clientSecret: "refunded_secret", checkoutUrl: "https://checkout" })
  });
  const paid = { id: 7019, order: { id: 9019 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };
  await processPaymobTransaction(paid);
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 3500 });
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 1200 });
  const [order] = await db.select().from(orders).where(eq(orders.email, "refunded@example.com"));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(order.providerPaymentStatus, "refunded");
  assert.equal(order.refundedAmountCents, 3500);
  assert.equal(variant.stockQty, 9);
});

test("processPaymobTransaction stores the cumulative amount refunded by Paymob", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Partial Refund", phone: "01012345678", email: "partial@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "34343434-3434-4434-8434-343434343434",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_partial", orderId: 9023,
      clientSecret: "partial_secret", checkoutUrl: "https://checkout" })
  });
  const paid = { id: 7023, order: { id: 9023 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };
  await processPaymobTransaction(paid);
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 1200 });
  const [order] = await db.select().from(orders).where(eq(orders.email, "partial@example.com"));
  assert.equal(order.providerPaymentStatus, "partially_refunded");
  assert.equal((order as typeof order & { refundedAmountCents?: number }).refundedAmountCents, 1200);
});

test("retryPaymobCheckout does not return a payment link after its reservation is released during the provider request", async () => {
  const { initiatePaymobCheckout, retryPaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";
  const first = await initiatePaymobCheckout({
    payload: { fullName: "Retry Expiry", phone: "01012345678", email: "retryexpiry@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff", now: new Date("2026-09-11T12:00:00Z"),
    config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_retry_expiry_first", orderId: 9020,
      clientSecret: "first_secret", checkoutUrl: "https://checkout/first" })
  });
  await processPaymobTransaction({ id: 7020, order: { id: 9020 }, amount_cents: 3500,
    currency: "EGP", integration_id: 123, success: false, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" } });
  await assert.rejects(retryPaymobCheckout({
    checkoutId: first.checkoutId, config, notificationUrl, redirectionUrl,
    now: new Date("2026-09-11T12:01:00Z"),
    createIntention: async () => {
      await releaseExpiredCheckoutReservations(new Date("2026-09-11T12:31:00Z"));
      return { intentionId: "pi_retry_expiry_second", orderId: 9021,
        clientSecret: "second_secret", checkoutUrl: "https://checkout/second" };
    }
  }), /checkout is no longer payable/i);
  const [attempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobIntentionId, "pi_retry_expiry_second"));
  assert.equal(attempt?.paymobOrderId, "9021");
});

test("initiatePaymobCheckout rejects an elapsed idempotent replay even before the expiry worker runs", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  const input = {
    payload: { fullName: "Elapsed Replay", phone: "01012345678", email: "elapsed@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob" as const,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "12121212-1212-4212-8212-121212121212",
    config: { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
      secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
      enabledMethods: [{ method: "card" as const, integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 as const },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_elapsed", orderId: 9022,
      clientSecret: "elapsed_secret", checkoutUrl: "https://checkout" })
  };
  await initiatePaymobCheckout({ ...input, now: new Date("2026-09-11T12:00:00Z") });
  await assert.rejects(
    initiatePaymobCheckout({ ...input, now: new Date("2026-09-11T12:31:00Z") }),
    /checkout is no longer payable/i
  );
});

test("a third declined Paymob attempt releases the stock hold so the customer can start again", async () => {
  const { initiatePaymobCheckout, retryPaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";
  const first = await initiatePaymobCheckout({ payload: { fullName: "Three Declines",
    phone: "01012345678", email: "three@example.com", governorate: "Cairo", cityArea: "Nasr City",
    addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "56565656-5656-4656-8656-565656565656", config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_three_1", orderId: 9031,
      clientSecret: "first", checkoutUrl: "https://checkout/1" }) });
  for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber++) {
    const result = await processPaymobTransaction({ id: 7030 + attemptNumber,
      order: { id: 9030 + attemptNumber }, amount_cents: 3500, currency: "EGP",
      integration_id: 123, success: false, pending: false, is_live: false, is_auth: false,
      is_capture: false, is_refunded: false, is_voided: false, has_parent_transaction: false,
      source_data: { type: "card" } });
    assert.equal(result.outcome, "failed");
    if (attemptNumber < 3) {
      await retryPaymobCheckout({ checkoutId: first.checkoutId, config, notificationUrl, redirectionUrl,
        createIntention: async () => ({ intentionId: `pi_three_${attemptNumber + 1}`,
          orderId: 9031 + attemptNumber, clientSecret: `secret_${attemptNumber + 1}`,
          checkoutUrl: `https://checkout/${attemptNumber + 1}` }) });
      if (attemptNumber === 2) {
        await processPaymobTransaction({ id: 7031, order: { id: 9031 }, amount_cents: 3500,
          currency: "EGP", integration_id: 123, success: false, pending: false, is_live: false,
          is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
          has_parent_transaction: false, source_data: { type: "card" } });
        const [stillReserved] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
        assert.equal(stillReserved.stockQty, 9, "an old duplicate decline must not release attempt three's stock");
      }
    }
  }
  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.publicId, first.checkoutId));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(session.state, "expired");
  assert.equal(variant.stockQty, 10);
  assert.equal((await db.select().from(orders)).length, 0);
});

test("a signed refund arriving before success is applied to the eventual order", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Premature Refund", phone: "01012345678", email: "premature-refund@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "90909090-9090-4090-8090-909090909090",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_premature_refund", orderId: 9104,
      clientSecret: "premature_secret", checkoutUrl: "https://checkout" })
  });
  const refund = { id: 7104, order: { id: 9104 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: true, refunded_amount_cents: 3500, is_voided: false, has_parent_transaction: false,
    source_data: { type: "card" } };

  const premature = await processPaymobTransaction(refund);
  assert.equal(premature.outcome, "refund_pending_success");
  assert.equal((await db.select().from(orders)).length, 0);

  const staleDecline = await processPaymobTransaction({ ...refund, success: false,
    is_refunded: false, refunded_amount_cents: 0 });
  assert.equal(staleDecline.outcome, "rejected");
  const [afterDecline] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobOrderId, "9104"));
  assert.equal(afterDecline.status, "pending");

  const unrelatedSuccess = await processPaymobTransaction({ ...refund, id: 7105,
    is_refunded: false, refunded_amount_cents: 0 });
  assert.equal(unrelatedSuccess.outcome, "rejected");
  assert.equal((await db.select().from(orders)).length, 0);

  const settled = await processPaymobTransaction({ ...refund, is_refunded: false, refunded_amount_cents: 0 });
  assert.equal(settled.outcome, "succeeded");
  const [order] = await db.select().from(orders).where(eq(orders.email, "premature-refund@example.com"));
  assert.equal(order.providerPaymentStatus, "refunded");
  assert.equal(order.refundedAmountCents, 3500);
});
