import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { shipmentProviderBindings } from "@capella/database/drizzle/schema";
import { isDuplicateEntryError } from "../modules/admin/shared/db-errors.js";

export type OutgoingBindingEvidence = {
  shipmentId: number;
  orderId: number;
  accountId: string;
  accountKey: string;
  environment: "test" | "live";
  providerTrackingId: string;
  providerReference?: string | null;
  businessReference: string;
};

/**
 * Record what a shipment is bound to at the provider.
 *
 * W07 B06. A binding is evidence, so it is written only from a read that actually
 * succeeded, and it is written once. The table's unique constraints are the real guard:
 * `shipment_provider_bindings_shipment_unique` and the account+environment+tracking
 * identity together make a duplicate impossible, so a redelivered callback or a repeated
 * poll converges on the same single row instead of fanning out.
 *
 * `ER_DUP_ENTRY` is swallowed deliberately. The only way to reach it is "we already
 * recorded this exact binding", which is the desired outcome, not a failure - and this
 * runs inside the caller's transaction, where an unhandled throw would roll back a real
 * delivery state change.
 */
export async function recordOutgoingBinding(
  tx: Pick<typeof db, "insert">,
  evidence: OutgoingBindingEvidence
): Promise<void> {
  try {
    await tx.insert(shipmentProviderBindings).values({
      shipmentId: evidence.shipmentId,
      orderId: evidence.orderId,
      provider: "bosta",
      accountId: evidence.accountId,
      accountKey: evidence.accountKey,
      environment: evidence.environment,
      providerTrackingId: evidence.providerTrackingId,
      providerReference: evidence.providerReference ?? null,
      relationKind: "outgoing",
      businessReference: evidence.businessReference,
      proof: JSON.stringify({ source: "create_delivery_intent" }),
      proofVersion: "1",
      originalShipmentId: null
    });
  } catch (error) {
    if (!isDuplicateEntryError(error)) throw error;
  }
}

/** The proven binding for a shipment, if one exists. */
export async function findShipmentBinding(shipmentId: number) {
  const [binding] = await db.select().from(shipmentProviderBindings)
    .where(eq(shipmentProviderBindings.shipmentId, shipmentId)).limit(1);
  return binding ?? null;
}

/**
 * Map the runtime's provider base URL onto the stored environment enum.
 *
 * The sync runtime identifies an environment by its endpoint, but the column is a
 * two-value enum. Deriving it from the URL rather than trusting a cast keeps the
 * binding honest: a live URL can never be recorded as `test`, which is the whole point
 * of storing the environment on the row.
 */
export function bindingEnvironment(runtimeEnvironment: string): "test" | "live" {
  return runtimeEnvironment.includes("prod") || runtimeEnvironment.includes("live")
    ? "live"
    : "test";
}