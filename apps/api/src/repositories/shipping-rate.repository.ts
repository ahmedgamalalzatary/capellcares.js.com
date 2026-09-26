import { and, eq } from "drizzle-orm";
import { shippingRates } from "@capella/database/drizzle/schema";
import { db } from "@capella/database/src/db";
import { buildRateIdentity, shippingRateAmountSchema,
  type ShippingRateContext } from "../modules/shipping/bosta/bosta-rate-context.js";
export type { ShippingRateContext } from "../modules/shipping/bosta/bosta-rate-context.js";

/**
 * Persists the last valid account rate as the fallback (D16). The structured
 * context determines a unique bounded key; destination/size/service columns
 * additionally guard the lookup. Legacy incomplete keys cannot serve a quote.
 * Invalid amounts are rejected rather than persisted.
 */
export async function saveShippingRate(context: ShippingRateContext & { amountCents: number }): Promise<void> {
  if (!shippingRateAmountSchema.safeParse(context.amountCents).success) {
    throw new Error("Refusing to persist an invalid shipping rate amount");
  }
  const rateKey = buildRateIdentity(context);
  await db
    .insert(shippingRates)
    .values({
      rateKey,
      amountCents: context.amountCents,
      size: context.size,
      destinationId: context.destinationId,
      serviceType: context.serviceType
    })
    .onDuplicateKeyUpdate({
      set: {
        amountCents: context.amountCents,
        size: context.size,
        destinationId: context.destinationId,
        serviceType: context.serviceType,
        fetchedAt: new Date()
      }
    });
}

export async function loadSavedShippingRate(
  context: ShippingRateContext
): Promise<{ amountCents: number; rateIdentity: string } | null> {
  const rateKey = buildRateIdentity(context);
  const [row] = await db
    .select()
    .from(shippingRates)
    .where(
      and(
        eq(shippingRates.rateKey, rateKey),
        eq(shippingRates.destinationId, context.destinationId),
        eq(shippingRates.size, context.size),
        eq(shippingRates.serviceType, context.serviceType)
      )
    )
    .limit(1);
  if (!row) return null;
  return { amountCents: row.amountCents, rateIdentity: row.rateKey };
}
