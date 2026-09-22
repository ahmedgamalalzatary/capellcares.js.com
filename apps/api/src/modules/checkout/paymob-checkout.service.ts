import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";
import type { CheckoutPayload } from "../../types/domain.js";
import { createReservedCheckout } from "../../repositories/checkout/checkout-reservation.repository.js";
import { CheckoutAmountChangedError, priceCheckout } from "../orders/orders.service.js";
import type { PaymobConfig } from "../payments/paymob/paymob-config.js";
import {
  createPaymobIntention,
  PaymobProviderError,
  type CreatePaymobIntentionInput
} from "../payments/paymob/paymob-client.js";

type PaymobIntention = {
  intentionId: string; orderId: number; clientSecret: string; checkoutUrl: string;
};

type IntentionCreator = (input: CreatePaymobIntentionInput) => Promise<PaymobIntention>;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Returns the stock held by a checkout's still-reserved lines and marks those lines released.
 * Used when the provider rejects an initiation and when recycling an abandoned checkout.
 */
async function releaseReservedStock(tx: DbTransaction, sessionId: number) {
  const reservations = await tx.select().from(checkoutReservations)
    .where(and(eq(checkoutReservations.checkoutSessionId, sessionId),
      eq(checkoutReservations.state, "reserved"))).for("update");
  for (const reservation of reservations) {
    await tx.update(productVariants)
      .set({ stockQty: sql`${productVariants.stockQty} + ${reservation.qty}` })
      .where(eq(productVariants.id, reservation.variantId));
    await tx.update(checkoutReservations).set({ state: "released" })
      .where(eq(checkoutReservations.id, reservation.id));
  }
}

function isDefinitivePaymobRejection(error: unknown): boolean {
  if (!(error instanceof PaymobProviderError) || error.status == null) return false;
  return error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 409 &&
    error.status !== 429;
}

function isTransientPaymobRejection(error: unknown): boolean {
  if (!(error instanceof PaymobProviderError) || error.status == null) return false;
  return error.status === 429;
}

function isDuplicateEntryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; cause?: { code?: string; cause?: { code?: string } } };
  return candidate.code === "ER_DUP_ENTRY" || candidate.cause?.code === "ER_DUP_ENTRY" ||
    candidate.cause?.cause?.code === "ER_DUP_ENTRY";
}

/**
 * Records a confirmed provider rejection as a failed attempt and frees the stock it held.
 */
async function failPaymobInitiation(sessionId: number, attemptId: number) {
  await db.transaction(async (tx) => {
    await tx.update(paymentAttempts)
      .set({ status: "failed", failureCode: "INTENTION_CREATION_FAILED" })
      .where(eq(paymentAttempts.id, attemptId));
    await releaseReservedStock(tx, sessionId);
    await tx.update(checkoutSessions).set({ state: "failed" })
      .where(eq(checkoutSessions.id, sessionId));
  });
}

/**
 * A throttled (429) request never created an intention, but it is retryable:
 * fail only the attempt so the session stays payable and keeps its stock hold.
 */
async function failThrottledPaymobAttempt(attemptId: number) {
  await db.update(paymentAttempts)
    .set({ status: "failed", failureCode: "INTENTION_CREATION_THROTTLED" })
    .where(eq(paymentAttempts.id, attemptId));
}

async function handleIntentionFailure(input: {
  error: unknown;
  sessionId: number;
  attemptId: number;
}): Promise<never> {
  if (isDefinitivePaymobRejection(input.error)) {
    await failPaymobInitiation(input.sessionId, input.attemptId);
  } else if (isTransientPaymobRejection(input.error)) {
    await failThrottledPaymobAttempt(input.attemptId);
  }
  throw input.error;
}

function normalizeEgyptianPhone(phone: string): string {
  if (phone.startsWith("+20")) return phone;
  if (phone.startsWith("0020")) return `+20${phone.slice(4)}`;
  return `+20${phone.replace(/^0/, "")}`;
}

function checkoutReturnUrl(redirectionUrl: string, checkoutId: string): string {
  const url = new URL(redirectionUrl);
  url.searchParams.set("checkoutId", checkoutId);
  return url.toString();
}

export async function initiatePaymobCheckout(input: {
  payload: CheckoutPayload;
  idempotencyKey: string;
  now?: Date;
  config: PaymobConfig;
  notificationUrl: string;
  redirectionUrl: string;
  createIntention?: IntentionCreator;
}) {
  if (!input.config.canInitiatePayments || !input.config.secretKey || !input.config.publicKey) {
    throw new Error("Paymob checkout is not configured");
  }
  const priced = await priceCheckout(input.payload);
  const cartSnapshot = JSON.stringify(priced.items);
  const amountCents = Math.round(priced.totalAmount * 100);
  if (input.payload.expectedAmountCents != null && amountCents !== input.payload.expectedAmountCents) {
    throw new CheckoutAmountChangedError();
  }
  const now = input.now ?? new Date();
  const publicKey = input.config.publicKey;
  const findExistingCheckout = () => db.select({
    sessionId: checkoutSessions.id,
    checkoutId: checkoutSessions.publicId,
    expiresAt: checkoutSessions.reservationExpiresAt,
    clientSecret: paymentAttempts.clientSecret,
    attemptStatus: paymentAttempts.status,
    cartSnapshot: checkoutSessions.cartSnapshot,
    amountCents: checkoutSessions.amountCents,
    state: checkoutSessions.state
  }).from(checkoutSessions)
    .innerJoin(paymentAttempts, eq(paymentAttempts.checkoutSessionId, checkoutSessions.id))
    .where(eq(checkoutSessions.idempotencyKey, input.idempotencyKey))
    .orderBy(desc(paymentAttempts.attemptNumber))
    .limit(1)
    .then((rows) => rows[0]);
  type ExistingCheckout = NonNullable<Awaited<ReturnType<typeof findExistingCheckout>>>;
  const resolveReuse = (existing: ExistingCheckout):
    { kind: "paymob_redirect"; checkoutId: string; checkoutUrl: string; expiresAt: string } | null => {
    if (existing.clientSecret) {
      if (existing.state === "completed") throw new Error("Checkout already completed");
      if (existing.state !== "payment_pending") throw new Error("Checkout is no longer payable");
      if (existing.expiresAt <= now) throw new Error("Checkout is no longer payable");
      if (existing.cartSnapshot !== cartSnapshot || existing.amountCents !== amountCents) {
        throw new Error("Idempotency key belongs to a different checkout");
      }
      return {
        kind: "paymob_redirect" as const,
        checkoutId: existing.checkoutId,
        checkoutUrl: `https://eg.checkout.paymob.com/?publicKey=${encodeURIComponent(publicKey)}&clientSecret=${encodeURIComponent(existing.clientSecret)}`,
        expiresAt: existing.expiresAt.toISOString()
      };
    }
    if (existing.attemptStatus === "pending" ||
      (existing.attemptStatus === "created" && existing.state === "payment_pending")) {
      throw new Error("Paymob checkout initiation is still in progress");
    }
    if (existing.cartSnapshot !== cartSnapshot || existing.amountCents !== amountCents) {
      throw new Error("Idempotency key belongs to a different checkout");
    }
    return null;
  };
  const merchantReference = `capella_${randomUUID()}`;
  type CheckoutPlan = { sessionId: number; checkoutId: string; expiresAt: Date; paymentAttemptId: number };
  let plan: CheckoutPlan | undefined = undefined;
  const existing = await findExistingCheckout();
  if (existing) {
    const reused = resolveReuse(existing);
    if (reused) return reused;
    // A throttled (429) initiation left the session payable with its stock still held
    // and no client secret. Allocate the next attempt on that session in place so the
    // reservation is never released — releasing first would let competing checkouts
    // take the held stock before this retry re-reserves it.
    const throttledRetry = await db.transaction(async (tx): Promise<CheckoutPlan | null> => {
      const [session] = await tx.select().from(checkoutSessions)
        .where(eq(checkoutSessions.id, existing.sessionId)).limit(1).for("update");
      if (!session || session.state !== "payment_pending" || session.reservationExpiresAt <= now) return null;
      const [latest] = await tx.select().from(paymentAttempts)
        .where(eq(paymentAttempts.checkoutSessionId, session.id))
        .orderBy(desc(paymentAttempts.attemptNumber)).limit(1).for("update");
      if (!latest || latest.status !== "failed" || latest.clientSecret !== null) return null;
      if (session.attemptCount >= 3) throw new Error("Payment attempt limit reached");
      const [attempt] = await tx.insert(paymentAttempts).values({
        checkoutSessionId: session.id,
        attemptNumber: session.attemptCount + 1,
        merchantReference,
        amountCents: session.amountCents,
        currency: session.currency,
        environment: input.config.mode,
        allowedIntegrationIds: JSON.stringify(input.config.enabledMethods.map((method) => method.integrationId)),
        status: "created",
        expiresAt: session.reservationExpiresAt
      }).$returningId();
      await tx.update(checkoutSessions).set({ attemptCount: session.attemptCount + 1 })
        .where(eq(checkoutSessions.id, session.id));
      return { sessionId: session.id, checkoutId: session.publicId,
        expiresAt: session.reservationExpiresAt, paymentAttemptId: attempt.id };
    });
    if (throttledRetry) {
      plan = throttledRetry;
    } else {
      // A previous initiation never produced a client secret (a crash after reserving, or a
      // confirmed provider rejection). Release anything it still holds and recycle the
      // idempotency key so a retry of the same cart can start clean.
      await db.transaction(async (tx) => {
        await releaseReservedStock(tx, existing.sessionId);
        await tx.delete(checkoutSessions).where(eq(checkoutSessions.id, existing.sessionId));
      });
    }
  }
  if (!plan) {
    const expiresAt = new Date(now.getTime() + input.config.intentionExpirationSeconds * 1000);
    const publicId = `checkout_${randomUUID()}`;
    let reserved: Awaited<ReturnType<typeof createReservedCheckout>>;
    try {
      reserved = await createReservedCheckout({
        publicId,
        idempotencyKey: input.idempotencyKey,
        customerType: input.payload.customerId ? "registered" : "guest",
        customerId: input.payload.customerId ?? null,
        fullName: input.payload.fullName,
        phone: normalizeEgyptianPhone(input.payload.phone),
        email: input.payload.email,
        governorate: input.payload.governorate,
        cityArea: input.payload.cityArea,
        addressLine: input.payload.addressLine,
        buildingApartment: input.payload.buildingApartment,
        notes: input.payload.notes ?? "",
        cartSnapshot,
        amountCents,
        reservationExpiresAt: expiresAt,
        reservations: priced.reservations,
        initialAttempt: { merchantReference, environment: input.config.mode,
          allowedIntegrationIds: input.config.enabledMethods.map((method) => method.integrationId), expiresAt }
      });
    } catch (error) {
      if (!isDuplicateEntryError(error)) throw error;
      // A concurrent request with the same idempotency key won the insert race; behave
      // like an idempotent replay instead of surfacing the database error.
      const winner = await findExistingCheckout();
      if (!winner) throw error;
      const reused = resolveReuse(winner);
      if (reused) return reused;
      throw new Error("Paymob checkout initiation is still in progress");
    }
    if (reserved.paymentAttemptId === null) throw new Error("Payment attempt allocation failed");
    plan = { sessionId: reserved.id, checkoutId: publicId, expiresAt, paymentAttemptId: reserved.paymentAttemptId };
  }
  const { sessionId, checkoutId, expiresAt, paymentAttemptId } = plan;

  const names = input.payload.fullName.trim().split(/\s+/);
  const intentionInput = {
    baseUrl: input.config.baseUrl,
    secretKey: input.config.secretKey,
    publicKey: input.config.publicKey,
    amountCents,
    integrationIds: input.config.enabledMethods.map((method) => method.integrationId),
    specialReference: merchantReference,
    expirationSeconds: Math.min(
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
      input.config.intentionExpirationSeconds
    ),
    notificationUrl: input.notificationUrl,
    redirectionUrl: checkoutReturnUrl(input.redirectionUrl, checkoutId),
    billingData: {
      first_name: names[0] ?? input.payload.fullName,
      last_name: names.slice(1).join(" ") || names[0] || input.payload.fullName,
      email: input.payload.email,
      phone_number: normalizeEgyptianPhone(input.payload.phone)
    },
    items: []
  };
  let intention: PaymobIntention;
  try {
    intention = await (input.createIntention ?? createPaymobIntention)(intentionInput);
  } catch (error) {
    intention = await handleIntentionFailure({
      error,
      sessionId,
      attemptId: paymentAttemptId
    });
  }
  const stillPayable = await db.transaction(async (tx) => {
    const [current] = await tx.select({ state: checkoutSessions.state, expiresAt: checkoutSessions.reservationExpiresAt })
      .from(checkoutSessions).where(eq(checkoutSessions.id, sessionId)).limit(1).for("update");
    await tx.update(paymentAttempts).set({
      paymobIntentionId: intention.intentionId,
      paymobOrderId: String(intention.orderId),
      clientSecret: intention.clientSecret,
      integrationId: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.integrationId : null,
      paymentMethod: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.method : null
    }).where(eq(paymentAttempts.id, paymentAttemptId));
    await tx.update(paymentAttempts).set({ status: "pending" })
      .where(and(eq(paymentAttempts.id, paymentAttemptId), eq(paymentAttempts.status, "created")));
    return (current?.state === "payment_pending" || current?.state === "completed") &&
      current.expiresAt > (input.now ?? new Date());
  });
  if (!stillPayable) throw new Error("Checkout is no longer payable");

  return { kind: "paymob_redirect" as const, checkoutId, checkoutUrl: intention.checkoutUrl, expiresAt: expiresAt.toISOString() };
}

export async function retryPaymobCheckout(input: {
  checkoutId: string;
  config: PaymobConfig;
  notificationUrl: string;
  redirectionUrl: string;
  createIntention?: IntentionCreator;
  now?: Date;
}) {
  if (!input.config.canInitiatePayments || !input.config.secretKey || !input.config.publicKey) {
    throw new Error("Paymob checkout is not configured");
  }
  const now = input.now ?? new Date();
  const merchantReference = `capella_${randomUUID()}`;
  const allocated = await db.transaction(async (tx) => {
    const [session] = await tx.select().from(checkoutSessions)
      .where(eq(checkoutSessions.publicId, input.checkoutId)).limit(1).for("update");
    if (!session) throw new Error("Checkout not found");
    if (session.state !== "payment_pending" || session.reservationExpiresAt <= now) {
      throw new Error("Checkout is no longer payable");
    }
    if (session.attemptCount >= 3) throw new Error("Payment attempt limit reached");
    const [latest] = await tx.select().from(paymentAttempts)
      .where(eq(paymentAttempts.checkoutSessionId, session.id))
      .orderBy(desc(paymentAttempts.attemptNumber)).limit(1).for("update");
    if (!latest || latest.status !== "failed") throw new Error("Previous payment attempt has not failed");
    const [attempt] = await tx.insert(paymentAttempts).values({
      checkoutSessionId: session.id,
      attemptNumber: session.attemptCount + 1,
      merchantReference,
      amountCents: session.amountCents,
      currency: session.currency,
      environment: input.config.mode,
      allowedIntegrationIds: JSON.stringify(input.config.enabledMethods.map((method) => method.integrationId)),
      status: "created",
      expiresAt: session.reservationExpiresAt
    }).$returningId();
    await tx.update(checkoutSessions).set({ attemptCount: session.attemptCount + 1 })
      .where(eq(checkoutSessions.id, session.id));
    return { session, attemptId: attempt.id };
  });
  const names = allocated.session.fullName.trim().split(/\s+/);
  const remainingSeconds = Math.floor((allocated.session.reservationExpiresAt.getTime() - now.getTime()) / 1000);
  const intentionInput = {
    baseUrl: input.config.baseUrl,
    secretKey: input.config.secretKey,
    publicKey: input.config.publicKey,
    amountCents: allocated.session.amountCents,
    integrationIds: input.config.enabledMethods.map((method) => method.integrationId),
    specialReference: merchantReference,
    expirationSeconds: Math.min(remainingSeconds, input.config.intentionExpirationSeconds),
    notificationUrl: input.notificationUrl,
    redirectionUrl: checkoutReturnUrl(input.redirectionUrl, input.checkoutId),
    billingData: {
      first_name: names[0] ?? allocated.session.fullName,
      last_name: names.slice(1).join(" ") || names[0] || allocated.session.fullName,
      email: allocated.session.email,
      phone_number: allocated.session.phone
    },
    items: []
  };
  let intention: PaymobIntention;
  try {
    intention = await (input.createIntention ?? createPaymobIntention)(intentionInput);
  } catch (error) {
    intention = await handleIntentionFailure({
      error,
      sessionId: allocated.session.id,
      attemptId: allocated.attemptId
    });
  }
  const stillPayable = await db.transaction(async (tx) => {
    const [current] = await tx.select({ state: checkoutSessions.state, expiresAt: checkoutSessions.reservationExpiresAt })
      .from(checkoutSessions).where(eq(checkoutSessions.id, allocated.session.id)).limit(1).for("update");
    await tx.update(paymentAttempts).set({
      paymobIntentionId: intention.intentionId,
      paymobOrderId: String(intention.orderId),
      clientSecret: intention.clientSecret,
      integrationId: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.integrationId : null,
      paymentMethod: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.method : null
    }).where(eq(paymentAttempts.id, allocated.attemptId));
    await tx.update(paymentAttempts).set({ status: "pending" })
      .where(and(eq(paymentAttempts.id, allocated.attemptId), eq(paymentAttempts.status, "created")));
    return (current?.state === "payment_pending" || current?.state === "completed") &&
      current.expiresAt > (input.now ?? new Date());
  });
  if (!stillPayable) throw new Error("Checkout is no longer payable");
  return { kind: "paymob_redirect" as const, checkoutId: input.checkoutId,
    checkoutUrl: intention.checkoutUrl, expiresAt: allocated.session.reservationExpiresAt.toISOString() };
}
