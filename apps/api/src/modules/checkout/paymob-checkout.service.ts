import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutSessions, paymentAttempts } from "@capella/database/drizzle/schema";
import type { CheckoutPayload } from "../../types/domain.js";
import { createReservedCheckout } from "../../repositories/checkout/checkout-reservation.repository.js";
import { priceCheckout } from "../orders/orders.service.js";
import type { PaymobConfig } from "../payments/paymob/paymob-config.js";
import { createPaymobIntention, type CreatePaymobIntentionInput } from "../payments/paymob/paymob-client.js";

type IntentionCreator = (input: CreatePaymobIntentionInput) => Promise<{
  intentionId: string; orderId: number; clientSecret: string; checkoutUrl: string;
}>;

function normalizeEgyptianPhone(phone: string): string {
  if (phone.startsWith("+20")) return phone;
  if (phone.startsWith("0020")) return `+20${phone.slice(4)}`;
  return `+20${phone.replace(/^0/, "")}`;
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
  const [existing] = await db.select({
    checkoutId: checkoutSessions.publicId,
    expiresAt: checkoutSessions.reservationExpiresAt,
    clientSecret: paymentAttempts.clientSecret,
    cartSnapshot: checkoutSessions.cartSnapshot,
    amountCents: checkoutSessions.amountCents,
    state: checkoutSessions.state
  }).from(checkoutSessions)
    .innerJoin(paymentAttempts, eq(paymentAttempts.checkoutSessionId, checkoutSessions.id))
    .where(eq(checkoutSessions.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing?.clientSecret) {
    if (existing.state === "completed") throw new Error("Checkout already completed");
    if (existing.state !== "payment_pending") throw new Error("Checkout is no longer payable");
    if (existing.expiresAt <= (input.now ?? new Date())) throw new Error("Checkout is no longer payable");
    if (existing.cartSnapshot !== cartSnapshot || existing.amountCents !== amountCents) {
      throw new Error("Idempotency key belongs to a different checkout");
    }
    return {
      kind: "paymob_redirect" as const,
      checkoutId: existing.checkoutId,
      checkoutUrl: `https://eg.checkout.paymob.com/?publicKey=${encodeURIComponent(input.config.publicKey)}&clientSecret=${encodeURIComponent(existing.clientSecret)}`,
      expiresAt: existing.expiresAt.toISOString()
    };
  }
  if (existing) throw new Error("Paymob checkout initiation is still in progress");
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + input.config.intentionExpirationSeconds * 1000);
  const publicId = `checkout_${randomUUID()}`;
  const merchantReference = `capella_${randomUUID()}`;
  const reserved = await createReservedCheckout({
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
  if (reserved.paymentAttemptId === null) throw new Error("Payment attempt allocation failed");
  const paymentAttemptId = reserved.paymentAttemptId;

  const names = input.payload.fullName.trim().split(/\s+/);
  const intention = await (input.createIntention ?? createPaymobIntention)({
    baseUrl: input.config.baseUrl,
    secretKey: input.config.secretKey,
    publicKey: input.config.publicKey,
    amountCents,
    integrationIds: input.config.enabledMethods.map((method) => method.integrationId),
    specialReference: merchantReference,
    expirationSeconds: input.config.intentionExpirationSeconds,
    notificationUrl: input.config.enabledMethods.every((method) => method.method === "card")
      ? input.notificationUrl : undefined,
    redirectionUrl: input.redirectionUrl,
    billingData: {
      first_name: names[0] ?? input.payload.fullName,
      last_name: names.slice(1).join(" ") || names[0] || input.payload.fullName,
      email: input.payload.email,
      phone_number: normalizeEgyptianPhone(input.payload.phone)
    },
    items: []
  });
  const stillPayable = await db.transaction(async (tx) => {
    const [current] = await tx.select({ state: checkoutSessions.state, expiresAt: checkoutSessions.reservationExpiresAt })
      .from(checkoutSessions).where(eq(checkoutSessions.id, reserved.id)).limit(1).for("update");
    await tx.update(paymentAttempts).set({
      paymobIntentionId: intention.intentionId,
      paymobOrderId: String(intention.orderId),
      clientSecret: intention.clientSecret,
      integrationId: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.integrationId : null,
      paymentMethod: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.method : null,
      status: "pending"
    }).where(eq(paymentAttempts.id, paymentAttemptId));
    return current?.state === "payment_pending" && current.expiresAt > (input.now ?? new Date());
  });
  if (!stillPayable) throw new Error("Checkout is no longer payable");

  return { kind: "paymob_redirect" as const, checkoutId: publicId, checkoutUrl: intention.checkoutUrl, expiresAt: expiresAt.toISOString() };
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
  const intention = await (input.createIntention ?? createPaymobIntention)({
    baseUrl: input.config.baseUrl,
    secretKey: input.config.secretKey,
    publicKey: input.config.publicKey,
    amountCents: allocated.session.amountCents,
    integrationIds: input.config.enabledMethods.map((method) => method.integrationId),
    specialReference: merchantReference,
    expirationSeconds: Math.min(remainingSeconds, input.config.intentionExpirationSeconds),
    notificationUrl: input.config.enabledMethods.every((method) => method.method === "card")
      ? input.notificationUrl : undefined,
    redirectionUrl: input.redirectionUrl,
    billingData: {
      first_name: names[0] ?? allocated.session.fullName,
      last_name: names.slice(1).join(" ") || names[0] || allocated.session.fullName,
      email: allocated.session.email,
      phone_number: allocated.session.phone
    },
    items: []
  });
  const stillPayable = await db.transaction(async (tx) => {
    const [current] = await tx.select({ state: checkoutSessions.state, expiresAt: checkoutSessions.reservationExpiresAt })
      .from(checkoutSessions).where(eq(checkoutSessions.id, allocated.session.id)).limit(1).for("update");
    await tx.update(paymentAttempts).set({
      paymobIntentionId: intention.intentionId,
      paymobOrderId: String(intention.orderId),
      clientSecret: intention.clientSecret,
      integrationId: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.integrationId : null,
      paymentMethod: input.config.enabledMethods.length === 1 ? input.config.enabledMethods[0]!.method : null,
      status: "pending"
    }).where(eq(paymentAttempts.id, allocated.attemptId));
    return current?.state === "payment_pending" && current.expiresAt > (input.now ?? new Date());
  });
  if (!stillPayable) throw new Error("Checkout is no longer payable");
  return { kind: "paymob_redirect" as const, checkoutId: input.checkoutId,
    checkoutUrl: intention.checkoutUrl, expiresAt: allocated.session.reservationExpiresAt.toISOString() };
}
