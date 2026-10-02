import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { carts, checkoutReservations, checkoutSessions, orderItems, orders, paymentAttempts, paymentWebhookEvents, paymobCallbackInbox, productVariants } from "@capella/database/drizzle/schema";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { createReservedCheckout, releaseExpiredCheckoutReservations } from "../../src/repositories/checkout/checkout-reservation.repository.js";

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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }],
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
      mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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

test("processPaymobTransaction clears a registered customer's stored cart after a successful payment", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const oldLine = { type: "product" as const, productId: ids.productOneId, variantId: ids.firstVariantId, qty: 1 };
  await db.insert(carts).values({ customerId: ids.customerId, lines: [oldLine] });
  await initiatePaymobCheckout({
    payload: {
      customerId: ids.customerId, fullName: "Paid Customer", phone: "01012345678", email: "paid@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
    },
    idempotencyKey: "34343434-3434-4434-8434-343434343434",
    config: {
      mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800
    },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_cart_clear", orderId: 9034, clientSecret: "secret_34", checkoutUrl: "https://checkout" })
  });

  const result = await processPaymobTransaction({
    id: 7034, order: { id: 9034 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" }
  });
  const [storedCart] = await db.select({ lines: carts.lines }).from(carts).where(eq(carts.customerId, ids.customerId));

  assert.equal(result.outcome, "succeeded");
  assert.deepEqual(storedCart?.lines, []);
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true,
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }],
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }],
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }, { method: "wallet", integrationId: 456 }],
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }, { method: "wallet", integrationId: 456 }],
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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

test("an early callback cannot settle by an unsigned reference before signed order binding", async () => {
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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

  assert.notEqual(earlyOutcome, "succeeded",
    "a callback whose signed order id is not yet recorded must NOT be settled via the unsigned reference");
  assert.equal((await db.select().from(orders).where(eq(orders.email, "fast@example.com"))).length, 0,
    "no order may be created while the signed provider order id is unknown");
  // Durable intake is the controller's job (verified in paymob-webhook.routes.test.ts): a
  // real callback always lands in the inbox before processing, so this early notification is
  // retained and reprocessed rather than lost. What must never happen is settling it here,
  // on the strength of an unsigned field.
  const [stored] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobOrderId, "9112"));
  assert.ok(stored, "the attempt is recorded and will match this callback once its id is saved");
});

test("a callback cannot be re-pointed at another checkout by rewriting an unsigned field", async () => {
  // `order.id` IS covered by Paymob's HMAC; `order.merchant_order_id` is NOT. Matching a
  // callback by the merchant reference therefore let anyone holding one validly-signed
  // callback rewrite that field and have it still verify - redirecting the payment at will
  // onto a checkout they do not own. Correlation must rest only on signed fields.
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";

  const victim = await initiatePaymobCheckout({
    payload: { fullName: "Victim", phone: "01012345678", email: "victim@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "ccccccc1-2345-4ccc-8ccc-cccccccccccc", now: new Date("2026-09-11T12:00:00Z"),
    config, notificationUrl, redirectionUrl,
    createIntention: async (request) => ({ intentionId: "pi_victim", orderId: 9901,
      clientSecret: "victim_secret", checkoutUrl: "https://checkout/victim",
      specialReference: request.specialReference })
  });
  const attacker = await initiatePaymobCheckout({
    payload: { fullName: "Attacker", phone: "01012345679", email: "attacker@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 2", buildingApartment: "2",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "ccccccc2-2345-4ccc-8ccc-cccccccccccc", now: new Date("2026-09-11T12:00:00Z"),
    config, notificationUrl, redirectionUrl,
    createIntention: async (request) => ({ intentionId: "pi_attacker", orderId: 9902,
      clientSecret: "attacker_secret", checkoutUrl: "https://checkout/attacker",
      specialReference: request.specialReference })
  });

  // The attacker holds a genuinely valid callback for their OWN order, then rewrites the
  // unsigned merchant reference to point at the victim's checkout.
  const [attackerAttempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobIntentionId, "pi_attacker"));
  // Blanking the SIGNED id is what forces correlation onto the unsigned field. Any attempt
  // whose provider order id is unknown - an intention created before it was recorded, a
  // legacy row, or one deliberately cleared - currently falls back to merchant_order_id,
  // and that fallback is attacker-reachable precisely because the field is unsigned.
  await db.update(paymentAttempts).set({ paymobOrderId: null })
    .where(eq(paymentAttempts.checkoutSessionId, victim.sessionId));
  const result = await processPaymobTransaction({
    id: 7901, order: { id: 9999, merchant_order_id: attackerAttempt!.merchantReference },
    amount_cents: 3500, currency: "EGP", integration_id: 123, success: true, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" }
  });

  assert.notEqual(result.outcome, "succeeded",
    "an unsigned merchant reference must never be able to settle a checkout");
  assert.equal((await db.select().from(orders).where(eq(orders.email, "victim@example.com"))).length, 0,
    "a rewritten unsigned reference must never settle someone else's checkout");
  assert.equal((await db.select().from(orders).where(eq(orders.email, "attacker@example.com"))).length, 0,
    "nor may it settle the attacker's own checkout when the signed id does not match");
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
      createIntention: async () => { throw new PaymobProviderError("Paymob intention request failed with status 400", { status: 400 }); } }),
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

test("initiatePaymobCheckout fails a definitive rejection without calling an unsupported lookup", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
    createIntention: async () => { throw new PaymobProviderError("Paymob intention request failed with status 400", { status: 400 }); }
  }), /failed with status 400/);

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(attempt.status, "failed");
  assert.equal(session.state, "failed");
  assert.equal(variant.stockQty, 10);
});

test("initiatePaymobCheckout keeps stock held after an ambiguous failure without calling an unsupported lookup", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
    createIntention: async () => { throw new PaymobProviderError("Paymob intention request timed out"); }
  }), /timed out/i);

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(attempt.status, "reconciliation_required");
  assert.equal(attempt.failureCode, "INTENTION_CREATION_AMBIGUOUS");
  assert.equal(session.state, "payment_pending");
  assert.equal(variant.stockQty, 9);

  const retried = await module.retryPaymobCheckout({
    checkoutId: session.publicId, config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    now: new Date("2026-09-11T12:01:00Z"),
    createIntention: async () => ({ intentionId: "pi_after_ambiguity", orderId: 9402,
      clientSecret: "retry_secret", checkoutUrl: "https://checkout/retry" })
  });
  assert.equal(retried.checkoutUrl, "https://checkout/retry");
  const attempts = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, session.id));
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].merchantReference, attempt.merchantReference);
  assert.equal(attempts[1].status, "pending");
});

test("an idempotent replay retries an ambiguous initiation without releasing reserved stock", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const payload = { fullName: "Ambiguous Replay", phone: "01012345678", email: "ambiguous-replay@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const idempotencyKey = "a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2";
  await assert.rejects(initiatePaymobCheckout({ payload, idempotencyKey, config,
    notificationUrl, redirectionUrl, now: new Date("2026-09-11T12:00:00Z"),
    createIntention: async () => { throw new PaymobProviderError("network timeout"); }
  }), /network timeout/);
  const [before] = await db.select().from(checkoutSessions)
    .where(eq(checkoutSessions.idempotencyKey, idempotencyKey));

  const replayed = await initiatePaymobCheckout({ payload, idempotencyKey, config,
    notificationUrl, redirectionUrl, now: new Date("2026-09-11T12:01:00Z"),
    createIntention: async () => ({ intentionId: "pi_ambiguous_replay", orderId: 9403,
      clientSecret: "replayed_secret", checkoutUrl: "https://checkout/replayed" })
  });
  assert.equal(replayed.checkoutId, before.publicId);
  const [stock] = await db.select({ qty: productVariants.stockQty }).from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(stock.qty, 9);
  const attempts = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, before.id));
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].failureCode, "INTENTION_CREATION_AMBIGUOUS");
  assert.equal(attempts[1].status, "pending");
});

test("initiatePaymobCheckout keeps the checkout recoverable when Paymob throttles with 429", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const payload = { fullName: "Throttled", phone: "01012345678", email: "throttled@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    paymentMethod: "paymob" as const, items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
  const idempotencyKey = "42942942-4294-4294-8294-429429429429";

  await assert.rejects(module.initiatePaymobCheckout({
    payload, idempotencyKey, now: new Date("2026-09-11T12:00:00Z"), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => {
      throw new PaymobProviderError("Paymob intention request failed with status 429", { status: 429 });
    }
  }), /failed with status 429/);

  const [session] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.checkoutSessionId, session.id));
  const [reservation] = await db.select().from(checkoutReservations)
    .where(eq(checkoutReservations.checkoutSessionId, session.id));
  const [variant] = await db.select({ stockQty: productVariants.stockQty }).from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId));

  assert.equal(session.state, "payment_pending");
  assert.equal(attempt.status, "failed");
  assert.equal(reservation.state, "reserved");
  assert.equal(variant.stockQty, 9);

  let retryExpirationSeconds = 0;
  const recovered = await module.initiatePaymobCheckout({ payload, idempotencyKey,
    now: new Date("2026-09-11T12:01:00Z"), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async (request) => {
      retryExpirationSeconds = request.expirationSeconds;
      return { intentionId: "pi_throttled_recovered", orderId: 9401,
        clientSecret: "recovered_secret", checkoutUrl: "https://checkout/recovered" };
    } });
  assert.equal(recovered.checkoutUrl, "https://checkout/recovered");
  assert.equal(retryExpirationSeconds, 1740,
    "the Paymob intention must expire with the remaining stock reservation");

  const [sessionAfter] = await db.select().from(checkoutSessions)
    .where(eq(checkoutSessions.idempotencyKey, idempotencyKey));
  const [reservationAfter] = await db.select().from(checkoutReservations)
    .where(eq(checkoutReservations.checkoutSessionId, sessionAfter.id));
  const attemptsAfter = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.checkoutSessionId, sessionAfter.id))
    .orderBy(paymentAttempts.attemptNumber);
  const [variantAfter] = await db.select({ stockQty: productVariants.stockQty }).from(productVariants)
    .where(eq(productVariants.id, ids.firstVariantId));

  assert.equal(sessionAfter.id, session.id, "throttled retry must reuse the existing session");
  assert.equal(reservationAfter.id, reservation.id, "throttled retry must never release/recreate the reservation");
  assert.equal(reservationAfter.state, "reserved");
  assert.equal(variantAfter.stockQty, 9, "stock must stay held through the retry");
  assert.equal(sessionAfter.attemptCount, 2);
  assert.equal(attemptsAfter.length, 2);
  assert.equal(attemptsAfter[0].status, "failed");
  assert.equal(attemptsAfter[0].failureCode, "INTENTION_CREATION_THROTTLED");
  assert.equal(attemptsAfter[1].status, "pending");
  assert.equal(attemptsAfter[1].clientSecret, "recovered_secret");
});

test("concurrent Paymob initiations with one idempotency key never leak a duplicate-entry error", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const input = {
    payload: { fullName: "Race Customer", phone: "01012345678", email: "race@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob" as const,
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "95959595-9595-4959-8959-959595959595", config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_race_window", orderId: 9501,
      clientSecret: "race_secret", checkoutUrl: "https://checkout/race" })
  };

  const results = await Promise.allSettled([
    module.initiatePaymobCheckout(input),
    module.initiatePaymobCheckout(input)
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      const message = String(result.reason?.message ?? result.reason);
      assert.ok(!/Duplicate entry|ER_DUP_ENTRY|Failed query|insert into/i.test(message),
        `leaked database error: ${message}`);
      assert.ok(/still in progress|different checkout/i.test(message),
        `expected a clean domain error, got: ${message}`);
    }
  }
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.equal((await db.select().from(checkoutSessions)).length, 1);
});

test("initiatePaymobCheckout does not recycle a failed attempt for a different cart on the same idempotency key", async () => {
  const module = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { PaymobProviderError } = await import("../../src/modules/payments/paymob/paymob-client.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
    createIntention: async () => { throw new PaymobProviderError("Paymob intention request failed with status 400", { status: 400 }); }
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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

test("an unsigned refund amount in the callback is ignored; only authenticated inquiry sets the total", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Unsigned", phone: "01012345678", email: "unsigned@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_unsigned", orderId: 9021, clientSecret: "s", checkoutUrl: "https://checkout" })
  });
  const paid = { id: 7021, order: { id: 9021 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };
  await processPaymobTransaction(paid, { verified: paid });
  // `refunded_amount_cents` is NOT part of Paymob's HMAC input list. Claiming a full
  // refund in the body must not be able to mark the order refunded on its own.
  const forged = await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 3500 },
    { verified: { ...paid, is_refunded: false, refunded_amount_cents: 0 } });
  const [order] = await db.select().from(orders).where(eq(orders.email, "unsigned@example.com"));
  assert.equal(order.refundedAmountCents, 0, "an unauthenticated refund amount never changes the total");
  assert.notEqual(order.providerPaymentStatus, "refunded");
  assert.ok(forged, "the outcome is still returned for auditing");
});

test("a signed refund uses the authenticated inquiry total and ignores the callback amount", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Proven", phone: "01012345678", email: "proven@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    config: { mode: "test", baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_proven", orderId: 9022, clientSecret: "s", checkoutUrl: "https://checkout" })
  });
  const paid = { id: 7022, order: { id: 9022 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };
  await processPaymobTransaction(paid, { verified: paid });
  // The callback claims 3500 (a full refund); the authenticated provider read says 1200.
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 3500 },
    { verified: { ...paid, is_refunded: true, refunded_amount_cents: 1200 } });
  const [order] = await db.select().from(orders).where(eq(orders.email, "proven@example.com"));
  assert.equal(order.refundedAmountCents, 1200, "the proven amount wins over the unsigned callback value");
  assert.equal(order.providerPaymentStatus, "partially_refunded");
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
      canInitiatePayments: true, intentionExpirationSeconds: 1800 },
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook",
    redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_refunded", orderId: 9019, clientSecret: "refunded_secret", checkoutUrl: "https://checkout" })
  });
  const paid = { id: 7019, order: { id: 9019 }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" } };
  await processPaymobTransaction(paid);
  // Refund totals must come from authenticated inquiry evidence, not the unsigned callback body.
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 3500 },
    { verified: { is_refunded: true, refunded_amount_cents: 3500 } });
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 1200 },
    { verified: { is_refunded: true, refunded_amount_cents: 1200 } });
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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
  await processPaymobTransaction({ ...paid, is_refunded: true, refunded_amount_cents: 1200 },
    { verified: { is_refunded: true, refunded_amount_cents: 1200 } });
  const [order] = await db.select().from(orders).where(eq(orders.email, "partial@example.com"));
  assert.equal(order.providerPaymentStatus, "partially_refunded");
  assert.equal((order as typeof order & { refundedAmountCents?: number }).refundedAmountCents, 1200);
});

test("retryPaymobCheckout does not return a payment link after its reservation is released during the provider request", async () => {
  const { initiatePaymobCheckout, retryPaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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

test("retryPaymobCheckout refuses a retry while a sibling attempt's evidence is unresolved", async () => {
  // The customer-facing button is hidden in this state, but the mutation itself was not
  // guarded: a direct POST still created a fresh intention while the FIRST payment's
  // success callback was durably received but not yet applied. The customer then pays
  // twice - and the second payment wins, with stock reserved for only one of them.
  const { initiatePaymobCheckout, retryPaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
  const redirectionUrl = "https://capellacares.com/checkout/payment-result";
  const first = await initiatePaymobCheckout({
    payload: { fullName: "Retry Guarded", phone: "01012345678", email: "retryguarded@example.com",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "paymob", items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "abababab-1234-4abc-8abc-abababababab", now: new Date("2026-09-11T12:00:00Z"),
    config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_retry_guard_first", orderId: 9410,
      clientSecret: "first_secret", checkoutUrl: "https://checkout/first" })
  });
  // The first attempt fails, so the session IS retryable by status alone.
  await processPaymobTransaction({ id: 7410, order: { id: 9410 }, amount_cents: 3500,
    currency: "EGP", integration_id: 123, success: false, pending: false, is_live: false,
    is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, source_data: { type: "card" } });
  // ...yet a SUCCESS callback for that same attempt is received and left unresolved.
  await receivePaymobCallback({ callbackType: "transaction", transaction: { id: 7410,
    order: { id: 9410 }, amount_cents: 3500, currency: "EGP", integration_id: 123, success: true,
    pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
    is_voided: false, has_parent_transaction: false, source_data: { type: "card" } } });

  let intentions = 0;
  await assert.rejects(retryPaymobCheckout({
    checkoutId: first.checkoutId, config, notificationUrl, redirectionUrl,
    now: new Date("2026-09-11T12:01:00Z"),
    createIntention: async () => { intentions += 1; return { intentionId: "pi_retry_guard_second",
      orderId: 9411, clientSecret: "second_secret", checkoutUrl: "https://checkout/second" }; }
  }), /evidence|pending|received|retry/i);
  assert.equal(intentions, 0, "no second intention may be created while evidence is unresolved");
});

test("a third decline does not release reserved stock while evidence is unresolved", async () => {
  // Third decline releases the reservation, which frees stock the customer may already
  // have paid for. With an unresolved callback outstanding the release must wait, or the
  // eventual success has nothing left to fulfil and the stock is sold twice.
  const { receivePaymobCallback } = await import("../../src/modules/payments/paymob/paymob-webhook.service.js");
  const { releaseExpiredCheckoutReservations } = await import("../../src/repositories/checkout/checkout-reservation.repository.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com" as const,
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
    enabledMethods: [{ method: "card" as const, integrationId: 123 }],
    canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  const session = await createReservedCheckout({
    publicId: `checkout_${crypto.randomUUID()}`, idempotencyKey: crypto.randomUUID(), customerType: "guest",
    customerId: null, fullName: "Third Decline", phone: "+201012345678", email: "thirddecline@example.com",
    governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1",
    notes: "", cartSnapshot: "[]", amountCents: 3500,
    reservationExpiresAt: new Date(Date.now() + 600_000),
    reservations: [{ variantId: ids.firstVariantId, qty: 2 }],
    initialAttempt: { merchantReference: "pi_third_decline", environment: "test", allowedIntegrationIds: [123],
      expiresAt: new Date(Date.now() + 600_000) }
  });
  // Three attempts used, the third declines, and an unrelated success callback for the same
  // provider order is sitting unresolved in the inbox.
  await db.update(paymentAttempts).set({ attemptNumber: 3, paymobOrderId: "9510" })
    .where(eq(paymentAttempts.checkoutSessionId, session.id));
  await db.update(checkoutSessions).set({ attemptCount: 3 }).where(eq(checkoutSessions.id, session.id));
  await receivePaymobCallback({ callbackType: "transaction", transaction: { id: 7510,
    order: { id: 9510 }, amount_cents: 3500, currency: "EGP", integration_id: 123, success: true,
    pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false,
    is_voided: false, has_parent_transaction: false, source_data: { type: "card" } } });

  await processPaymobTransaction({ id: 7510, order: { id: 9510 }, amount_cents: 3500, currency: "EGP",
    integration_id: 123, success: false, pending: false, is_live: false, is_auth: false,
    is_capture: false, is_refunded: false, is_voided: false, has_parent_transaction: false,
    source_data: { type: "card" } });

  const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(variant.stockQty, 8, "stock must stay reserved while a success callback is unresolved");
  const [checkout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, session.id));
  assert.equal(checkout.state, "payment_pending", "the session must not expire while evidence is unresolved");
  await releaseExpiredCheckoutReservations(new Date(Date.now() + 3_600_000));
  const [afterExpiryVariant] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  const [afterExpiryCheckout] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, session.id));
  assert.equal(afterExpiryVariant.stockQty, 8, "expiry must not release stock behind queued financial evidence");
  assert.equal(afterExpiryCheckout.state, "payment_pending", "expiry must retain the held checkout for recovery");
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
      secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
    secretKey: "secret", publicKey: "public", hmacSecret: "hmac", apiKey: null,
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
      hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card", integrationId: 123 }],
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

  const premature = await processPaymobTransaction(refund,
    { verified: { is_refunded: true, refunded_amount_cents: 3500 } });
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

const config = {
  mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public",
  hmacSecret: "hmac", apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }],
  canInitiatePayments: true, intentionExpirationSeconds: 1800 as const
};
const notificationUrl = "https://api.capellacares.com/api/v1/payments/paymob/webhook";
const redirectionUrl = "https://capellacares.com/checkout/payment-result";

type Callback = Record<string, any>;

function paidTransaction(orderId: number, txnId: number): Callback {
  return {
    id: txnId, order: { id: orderId }, amount_cents: 3500, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false,
    is_refunded: false, is_voided: false, has_parent_transaction: false, source_data: { type: "card" }
  };
}

async function createPaidSession(options: {
  email: string; idempotencyKey: string; intentionId: string; orderId: number; txnId: number;
}) {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: {
      fullName: "Post Success", phone: "01012345678", email: options.email, governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }]
    },
    idempotencyKey: options.idempotencyKey, config, notificationUrl, redirectionUrl,
    createIntention: async () => ({
      intentionId: options.intentionId, orderId: options.orderId,
      clientSecret: "paid_secret", checkoutUrl: "https://checkout"
    })
  });
  const first = await processPaymobTransaction(paidTransaction(options.orderId, options.txnId));
  assert.equal(first.outcome, "succeeded");
  return { ids, processPaymobTransaction };
}

test("the audit outcome commits atomically with the payment, so a crash cannot lose it", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Atomic", phone: "01012345678", email: "atomic@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "12121212-1212-4212-8212-121212121212",
    config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_atomic", orderId: 9411, clientSecret: "s", checkoutUrl: "https://checkout" })
  });
  const transaction = paidTransaction(9411, 8411);
  const result = await processPaymobTransaction(transaction, { audit: { transaction } });
  assert.equal(result.outcome, "succeeded");
  // The order and its audit outcome must both exist, or both be absent. Previously the
  // audit row was written by a separate call after the business transaction committed,
  // so a crash in between lost the outcome while the order survived.
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 1, "exactly one audit row for the success");
  assert.equal((await db.select().from(orders)).length, 1, "exactly one canonical order");
});

test("a rolled-back payment leaves no audit row claiming it was processed", async () => {
  const { initiatePaymobCheckout } = await import("../../src/modules/checkout/paymob-checkout.service.js");
  const { processPaymobTransaction } = await import("../../src/modules/payments/paymob/paymob-transaction.service.js");
  const ids = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Rollback", phone: "01012345678", email: "rollback@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] },
    idempotencyKey: "13131313-1313-4313-8313-131313131313",
    config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_rollback", orderId: 9412, clientSecret: "s", checkoutUrl: "https://checkout" })
  });
  // A wrong amount is a safe `reconciliation_required`, not a throw, so corrupt the stored
  // snapshot instead: the happy path then fails after deciding to create an order, which
  // is the rollback we need to observe.
  const ids2 = await getBaselineIds();
  await initiatePaymobCheckout({
    payload: { fullName: "Rollback Two", phone: "01012345678", email: "rollback2@example.com", governorate: "Cairo",
      cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "paymob",
      items: [{ type: "product", variantId: ids2.firstVariantId, qty: 1 }] },
    idempotencyKey: "14141414-1414-4414-8414-141414141414",
    config, notificationUrl, redirectionUrl,
    createIntention: async () => ({ intentionId: "pi_rollback2", orderId: 9413, clientSecret: "s", checkoutUrl: "https://checkout" })
  });
  const duplicate = { ...paidTransaction(9413, 8413) };
  // Corrupt the stored snapshot so the happy path throws after deciding to create an order.
  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.paymobOrderId, "9413"));
  await db.update(checkoutSessions).set({ shippingSnapshot: "not-valid-snapshot" })
    .where(eq(checkoutSessions.id, attempt!.checkoutSessionId));
  await assert.rejects(processPaymobTransaction(duplicate, { audit: { transaction: duplicate } }));
  assert.equal((await db.select().from(orders).where(eq(orders.email, "rollback2@example.com"))).length, 0,
    "no order survives the rollback");
  assert.equal((await db.select().from(paymentWebhookEvents)).length, 0,
    "and no audit row claims it was processed");
});

test("a later, smaller authenticated refund never lowers a monotonic refund total", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "monotonic@example.com", idempotencyKey: "1b1b1b1b-1b1b-4b1b-8b1b-1b1b1b1b1b1b",
    intentionId: "pi_monotonic", orderId: 9308, txnId: 8311
  });
  const base = { ...paidTransaction(9308, 8311), is_refunded: true, refunded_amount_cents: 3500 };
  await processPaymobTransaction(base, { verified: { is_refunded: true, refunded_amount_cents: 3500 } });
  // An out-of-order or stale provider read reporting a smaller cumulative total must not
  // walk the recorded refund backwards.
  await processPaymobTransaction({ ...base, refunded_amount_cents: 1200 },
    { verified: { is_refunded: true, refunded_amount_cents: 1200 } });
  const [order] = await db.select().from(orders).where(eq(orders.email, "monotonic@example.com"));
  assert.equal(order.refundedAmountCents, 3500, "the recorded refund total only ever increases");
  assert.equal(order.providerPaymentStatus, "refunded", "a fully refunded order stays fully refunded");
});

test("a growing authenticated refund is applied cumulatively", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "cumulative@example.com", idempotencyKey: "1c1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c",
    intentionId: "pi_cumulative", orderId: 9309, txnId: 8312
  });
  const base = { ...paidTransaction(9309, 8312), is_refunded: true };
  await processPaymobTransaction({ ...base, refunded_amount_cents: 1000 },
    { verified: { is_refunded: true, refunded_amount_cents: 1000 } });
  await processPaymobTransaction({ ...base, refunded_amount_cents: 2500 },
    { verified: { is_refunded: true, refunded_amount_cents: 2500 } });
  const [order] = await db.select().from(orders).where(eq(orders.email, "cumulative@example.com"));
  assert.equal(order.refundedAmountCents, 2500);
  assert.equal(order.providerPaymentStatus, "partially_refunded");
});

test("processPaymobTransaction rejects a wrong-amount callback after the payment already succeeded", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-amount@example.com", idempotencyKey: "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2",
    intentionId: "pi_post_success_amount", orderId: 9301, txnId: 8301
  });

  const result = await processPaymobTransaction({
    ...paidTransaction(9301, 8302), amount_cents: 9999
  });

  assert.equal(result.outcome, "rejected");
});

test("processPaymobTransaction rejects an out-of-order decline after the payment already succeeded", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-decline@example.com", idempotencyKey: "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3",
    intentionId: "pi_post_success_decline", orderId: 9302, txnId: 8303
  });

  const result = await processPaymobTransaction({
    ...paidTransaction(9302, 8304), success: false
  });

  assert.equal(result.outcome, "rejected");
});

test("processPaymobTransaction rejects a wrong-environment callback after the payment already succeeded", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-env@example.com", idempotencyKey: "c4c4c4c4-c4c4-4c4c-8c4c-c4c4c4c4c4c4",
    intentionId: "pi_post_success_env", orderId: 9303, txnId: 8305
  });

  const result = await processPaymobTransaction({
    ...paidTransaction(9303, 8305), is_live: true
  });

  assert.equal(result.outcome, "rejected");
});

test("processPaymobTransaction flags a second distinct capture for reconciliation instead of acknowledging success", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-double-capture@example.com",
    idempotencyKey: "d5d5d5d5-d5d5-4d5d-8d5d-d5d5d5d5d5d5",
    intentionId: "pi_post_success_double", orderId: 9304, txnId: 8306
  });

  const result = await processPaymobTransaction(paidTransaction(9304, 8307));

  assert.equal(result.outcome, "reconciliation_required");
  const [attempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobOrderId, "9304")).limit(1);
  assert.equal(attempt.status, "succeeded");
  assert.equal(attempt.failureCode, "SECOND_CAPTURE_AFTER_SUCCESS");
  assert.equal((await db.select().from(orders).where(eq(orders.email, "post-success-double-capture@example.com"))).length, 1);
});

test("second-capture flag keeps the post-success flow intact for duplicates and refunds", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-flag-continues@example.com",
    idempotencyKey: "1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a",
    intentionId: "pi_post_success_flag", orderId: 9307, txnId: 8310
  });

  const secondCapture = await processPaymobTransaction(paidTransaction(9307, 8311));
  assert.equal(secondCapture.outcome, "reconciliation_required");

  const duplicate = await processPaymobTransaction(paidTransaction(9307, 8310));
  assert.equal(duplicate.outcome, "succeeded");

  const refund = await processPaymobTransaction({
    ...paidTransaction(9307, 8310), is_refunded: true, refunded_amount_cents: 3500
  }, { verified: { is_refunded: true, refunded_amount_cents: 3500 } });
  assert.equal(refund.outcome, "refunded");

  const [attempt] = await db.select().from(paymentAttempts)
    .where(eq(paymentAttempts.paymobOrderId, "9307")).limit(1);
  assert.equal(attempt.status, "succeeded");
  assert.equal(attempt.failureCode, "SECOND_CAPTURE_AFTER_SUCCESS");
  const [order] = await db.select().from(orders)
    .where(eq(orders.email, "post-success-flag-continues@example.com")).limit(1);
  assert.equal(order.providerPaymentStatus, "refunded");
  assert.equal(order.refundedAmountCents, 3500);
});

test("processPaymobTransaction rejects a failed refund callback after the payment already succeeded", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-failed-refund@example.com",
    idempotencyKey: "e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6",
    intentionId: "pi_post_success_failed_refund", orderId: 9305, txnId: 8308
  });

  const result = await processPaymobTransaction({
    ...paidTransaction(9305, 8308), is_refunded: true, refunded_amount_cents: 3500, success: false
  }, { verified: { is_refunded: true, refunded_amount_cents: 3500 } });

  assert.equal(result.outcome, "rejected");
  const [order] = await db.select().from(orders)
    .where(eq(orders.email, "post-success-failed-refund@example.com")).limit(1);
  assert.equal(order.providerPaymentStatus, "succeeded");
});

test("processPaymobTransaction still acknowledges a duplicate delivery of the original success", async () => {
  const { processPaymobTransaction } = await createPaidSession({
    email: "post-success-duplicate@example.com",
    idempotencyKey: "f7f7f7f7-f7f7-4f7f-8f7f-f7f7f7f7f7f7",
    intentionId: "pi_post_success_duplicate", orderId: 9306, txnId: 8309
  });

  const duplicate = await processPaymobTransaction(paidTransaction(9306, 8309));

  assert.equal(duplicate.outcome, "succeeded");
});
