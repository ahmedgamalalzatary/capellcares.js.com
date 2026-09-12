import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, paymentAttempts, productVariants } from "@capella/database/drizzle/schema";

interface ReservedCheckoutInput {
  publicId: string;
  idempotencyKey: string;
  customerType: "guest" | "registered";
  customerId: number | null;
  fullName: string;
  phone: string;
  email: string;
  governorate: string;
  cityArea: string;
  addressLine: string;
  buildingApartment: string;
  notes: string;
  cartSnapshot: string;
  amountCents: number;
  reservationExpiresAt: Date;
  reservations: Array<{ variantId: number; qty: number }>;
  initialAttempt?: {
    merchantReference: string;
    environment: "test" | "live";
    allowedIntegrationIds: number[];
    expiresAt: Date;
  };
}

export async function createReservedCheckout(input: ReservedCheckoutInput) {
  return db.transaction(async (tx) => {
    const [session] = await tx.insert(checkoutSessions).values({
      publicId: input.publicId,
      idempotencyKey: input.idempotencyKey,
      customerType: input.customerType,
      customerId: input.customerId,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      governorate: input.governorate,
      cityArea: input.cityArea,
      addressLine: input.addressLine,
      buildingApartment: input.buildingApartment,
      notes: input.notes,
      cartSnapshot: input.cartSnapshot,
      amountCents: input.amountCents,
      shippingAmountCents: 0,
      currency: "EGP",
      state: "payment_pending",
      attemptCount: input.initialAttempt ? 1 : 0,
      reservationExpiresAt: input.reservationExpiresAt
    }).$returningId();

    for (const reservation of input.reservations) {
      const result = await tx.update(productVariants)
        .set({ stockQty: sql`${productVariants.stockQty} - ${reservation.qty}` })
        .where(and(
          eq(productVariants.id, reservation.variantId),
          gte(productVariants.stockQty, reservation.qty)
        ));
      if (result[0].affectedRows !== 1) throw new Error("Insufficient stock");
      await tx.insert(checkoutReservations).values({
        checkoutSessionId: session.id,
        variantId: reservation.variantId,
        qty: reservation.qty,
        state: "reserved"
      });
    }

    let paymentAttemptId: number | null = null;
    if (input.initialAttempt) {
      const [attempt] = await tx.insert(paymentAttempts).values({
        checkoutSessionId: session.id,
        attemptNumber: 1,
        merchantReference: input.initialAttempt.merchantReference,
        amountCents: input.amountCents,
        currency: "EGP",
        environment: input.initialAttempt.environment,
        allowedIntegrationIds: JSON.stringify(input.initialAttempt.allowedIntegrationIds),
        status: "created",
        expiresAt: input.initialAttempt.expiresAt
      }).$returningId();
      paymentAttemptId = attempt.id;
    }

    return { id: session.id, publicId: input.publicId, paymentAttemptId };
  });
}

export async function releaseExpiredCheckoutReservations(now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const expired = await tx.select({ id: checkoutSessions.id })
      .from(checkoutSessions)
      .where(and(
        eq(checkoutSessions.state, "payment_pending"),
        lte(checkoutSessions.reservationExpiresAt, now)
      ))
      .for("update");

    for (const session of expired) {
      const reservations = await tx.select()
        .from(checkoutReservations)
        .where(and(
          eq(checkoutReservations.checkoutSessionId, session.id),
          eq(checkoutReservations.state, "reserved")
        ))
        .for("update");
      for (const reservation of reservations) {
        await tx.update(productVariants)
          .set({ stockQty: sql`${productVariants.stockQty} + ${reservation.qty}` })
          .where(eq(productVariants.id, reservation.variantId));
        await tx.update(checkoutReservations)
          .set({ state: "released" })
          .where(eq(checkoutReservations.id, reservation.id));
      }
      await tx.update(checkoutSessions)
        .set({ state: "expired" })
        .where(eq(checkoutSessions.id, session.id));
    }
  });
}
