import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { adminUsers, adminUserPermissions, permissions, orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { shipmentEditSchema, checkoutShippingQuoteSchema } from "@capella/shared";
import type { ShipmentEdit } from "@capella/shared";
import { assertShippingEditAllowed, type ShippingEditEvidence } from "./shipping-state.repository.js";
import { recordShippingObservation } from "./shipping-sync.repository.js";
import { BostaProviderError } from "./bosta/bosta-client.js";
import { assertAddressMatches, type NormalizedReadAddress } from "./bosta/bosta-delivery-read.js";
import { assertAddressAllowed, buildDropOffFirstLine } from "./shipping-restrictions.js";
import type { BostaEditRuntime } from "./bosta/bosta-edit.service.js";
import type { BostaObservation, BostaSyncRuntime } from "./bosta/bosta-sync.service.js";
import type { ShippingTransaction } from "./shipping-dispatch.repository.js";
import { ShippingRuleError } from "./shipping-rule-error.js";

export class ShippingEditError extends ShippingRuleError {}
export async function assertShippingActor(tx: ShippingTransaction, actorId: number) {
  const [actor] = await tx.select().from(adminUsers).where(eq(adminUsers.id, actorId)).limit(1);
  const grants = actor?.role === "staff" ? await tx.select({ key: permissions.key }).from(adminUserPermissions)
    .innerJoin(permissions, eq(permissions.id, adminUserPermissions.permissionId))
    .where(eq(adminUserPermissions.adminUserId, actorId)) : [];
  if (!actor?.isActive || (actor.role !== "admin" && !["orders.read", "shipping.read", "shipping.update_state"].every(key => grants.some(grant => grant.key === key)))) {
    throw new ShippingEditError("Shipping modification permission required; actor is not authorized");
  }
}

const phone = (value: string) => value.startsWith("+20") ? value : value.startsWith("0020") ? `+20${value.slice(4)}` : `+20${value.replace(/^0/, "")}`;

/** Shared strict comparison. A read without provable identity never confirms an edit. */
const addressMatches = (actual: NormalizedReadAddress, requested: { zoneId: string | null; districtId: string | null; firstLine: string }) => {
  try {
    assertAddressMatches(actual, requested);
    return true;
  } catch {
    return false;
  }
};
/** The public Bosta edit schema establishes the recipient phone and the drop-off address only. A patch that also changes the recipient name, notes or package size must be refused before any carrier read or write unless the merchant account has explicit verified evidence for that field — an unproven edit must never reach Bosta. */
function unverifiedEditFields(patch: ShipmentEdit, editableFields: ReadonlySet<string>): string[] {
  return [
    ...(patch.recipient?.fullName !== undefined && !editableFields.has("recipientName") ? ["recipient name"] : []),
    ...(patch.notes !== undefined && !editableFields.has("notes") ? ["notes"] : []),
    ...(patch.size !== undefined && !editableFields.has("size") ? ["package size"] : [])
  ];
}
function editPayload(patch: ShipmentEdit, city: string) {
  const payload: Record<string, unknown> = {};
  if (patch.recipient) {
    const names = patch.recipient.fullName?.split(/\s+/);
    payload.receiver = { ...(names ? { fullName: patch.recipient.fullName, firstName: names[0], lastName: names.slice(1).join(" ") || names[0] } : {}),
      ...(patch.recipient.phone !== undefined ? { phone: phone(patch.recipient.phone) } : {}) };
  }
  if (patch.address) payload.dropOffAddress = { city, zoneId: patch.address.zoneId, districtId: patch.address.districtId,
    firstLine: buildDropOffFirstLine(patch.address.addressLine, patch.address.buildingApartment) };
  if (patch.notes !== undefined) payload.notes = patch.notes;
  if (patch.size) payload.specs = { size: { small: "SMALL", medium: "MEDIUM", large: "LARGE" }[patch.size] };
  return payload;
}

/** Runs under the same order/shipment locks as synchronization. A read confirms an edit; an acknowledgement alone never invents carrier data. Recovery never repeats the PUT. */
export async function confirmShippingEdits(tx: ShippingTransaction, ship: typeof shipments.$inferSelect, event: BostaObservation) {
  const jobs = await tx.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.shipmentId, ship.id),
    eq(shippingWorkItems.operation, "edit_delivery"), inArray(shippingWorkItems.status, ["processing", "review_required", "failed"]))).for("update");
  if (event.source !== "read" || event.businessReference !== ship.idempotencyKey || event.atMs < (ship.providerEventAtMs ?? 0)) return;
  for (const job of jobs) {
    if (job.status === "failed" && job.lastError !== "EDIT_REJECTED") continue;
    const saved = JSON.parse(job.requestSnapshot!);
    const patch = shipmentEditSchema.parse(saved.patch);
    const recipient = event.carrier.recipient as Record<string, unknown> | undefined;
    // Identity comes from the shared normalizer, not from assuming flat provider fields: a documented address may carry a district name and no district id.
    const addressIdentity = event.carrier.addressIdentity;
    const matched = (patch.notes === undefined || patch.notes === event.carrier.notes) &&
      (!patch.size || saved.payload.specs.size === event.carrier.size) &&
      (!patch.recipient?.fullName || recipient?.fullName === patch.recipient.fullName) &&
      (!patch.recipient?.phone || (typeof recipient?.phone === "string" && phone(recipient.phone) === phone(patch.recipient.phone))) &&
      (!patch.address || (addressIdentity !== undefined && addressMatches(
        addressIdentity, { zoneId: patch.address.zoneId, districtId: patch.address.districtId,
          firstLine: saved.payload.dropOffAddress.firstLine })));
    if (!matched) continue;
    if (patch.size) await tx.update(shipments).set({ size: patch.size }).where(eq(shipments.id, ship.id));
    await tx.update(shippingWorkItems).set({ status: "succeeded", lastError: null, claimedBy: null, claimedAt: null,
      responseSnapshot: JSON.stringify(event.carrier) }).where(eq(shippingWorkItems.id, job.id));
  }
}

export async function applyShippingNoMoneyEdit(orderId: number, input: unknown, actorId: number, edit: BostaEditRuntime | null) {
  const patch = shipmentEditSchema.parse(input);
  // Authorize before reading customer or carrier data.
  await db.transaction(tx => assertShippingActor(tx, actorId));
  const [ship] = await db.select().from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.kind, "outgoing"))).limit(1);
  let evidence: ShippingEditEvidence | undefined;
  if (ship) {
    if (!edit) throw new ShippingEditError("Verified merchant edit availability is required for linked shipments");
    const unverified = unverifiedEditFields(patch, edit.editableFields ?? new Set());
    if (unverified.length) throw new ShippingEditError(`Shipment edit fields require verified merchant evidence: ${unverified.join(", ")}`);
    const read = await edit.read(ship.trackingNumber, ship.idempotencyKey);
    if (!read.editable || !read.prePickup || read.observation.trackingNumber !== ship.trackingNumber || read.observation.businessReference !== ship.idempotencyKey) {
      throw new ShippingEditError("Fresh verified carrier pre-pickup edit availability evidence is required");
    }
    await recordShippingObservation(edit.sync, read.observation);
    evidence = { verified: true, editable: true, prePickup: true, trackingNumber: ship.trackingNumber,
      stateCode: read.observation.stateCode, eventAtMs: read.observation.atMs, accountId: edit.sync.accountId,
      environment: edit.sync.environment, businessReference: ship.idempotencyKey };
  }
  const intent = await db.transaction(async tx => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
    await assertShippingActor(tx, actorId);
    if (!order?.shippingSnapshot) throw new ShippingEditError("Shipping order not found");
    const pending = await tx.select({ id: shippingWorkItems.id }).from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, orderId),
      eq(shippingWorkItems.operation, "edit_delivery"), inArray(shippingWorkItems.status, ["processing", "review_required"]))).limit(1).for("update");
    if (pending.length) throw new ShippingEditError("An unresolved shipment edit is pending; reconcile before another edit");
    await assertShippingEditAllowed(tx, orderId, patch, evidence);
    const snapshot = checkoutShippingQuoteSchema.parse(JSON.parse(order.shippingSnapshot));
    if (patch.address && (patch.address.cityId !== snapshot.address.cityId || patch.address.zoneId !== snapshot.address.zoneId || patch.address.districtId !== snapshot.address.districtId)) {
      throw new ShippingEditError("Destination city/zone/district changes require cancellation and a new order");
    }
    // Validate the address the carrier will receive BEFORE the PUT intent is saved, so an address the carrier would reject never becomes a pending work item.
    if (patch.address) assertAddressAllowed(patch.address.addressLine, patch.address.buildingApartment);
    if (!ship) {
      await tx.update(shippingWorkItems).set({ requestSnapshot: null }).where(and(eq(shippingWorkItems.orderId, orderId),
        eq(shippingWorkItems.operation, "create_delivery"), eq(shippingWorkItems.status, "failed"), eq(shippingWorkItems.lastError, "CREATE_REJECTED")));
      await tx.update(orders).set({ ...(patch.recipient?.fullName !== undefined ? { fullName: patch.recipient.fullName } : {}),
        ...(patch.recipient?.phone !== undefined ? { phone: patch.recipient.phone } : {}),
        ...(patch.address ? { addressLine: patch.address.addressLine, buildingApartment: patch.address.buildingApartment } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}), ...(patch.size ? { shippingSize: patch.size } : {}) }).where(eq(orders.id, orderId));
      return null;
    }
    const payload = editPayload(patch, snapshot.address.cityName.en);
    const [job] = await tx.insert(shippingWorkItems).values({ orderId, shipmentId: ship.id, operation: "edit_delivery",
      idempotencyKey: `bosta_edit_${randomUUID()}`, status: "processing", attemptCount: 1,
      claimedBy: String(actorId), claimedAt: new Date(), nextAttemptAt: new Date(Math.floor(Date.now() / 1000) * 1000),
      requestSnapshot: JSON.stringify({ actorId, accountId: edit!.sync.accountId, environment: edit!.sync.environment,
        trackingNumber: ship.trackingNumber, businessReference: ship.idempotencyKey, patch, payload }) }).$returningId();
    return { id: job.id, payload };
  });
  if (!intent || !ship) return { linked: false, applied: patch };
  try {
    await edit!.update(ship.trackingNumber, intent.payload);
  } catch (error) {
    if (error instanceof BostaProviderError && ["definitive", "throttled"].includes(error.kind)) {
      await db.update(shippingWorkItems).set({ status: "failed", lastError: "EDIT_REJECTED", claimedBy: null, claimedAt: null })
        .where(and(eq(shippingWorkItems.id, intent.id), eq(shippingWorkItems.status, "processing")));
      throw new ShippingEditError("Carrier rejected the shipment edit");
    }
  }
  try {
    const read = await edit!.read(ship.trackingNumber, ship.idempotencyKey);
    await recordShippingObservation(edit!.sync, read.observation);
  } catch { /* A failed confirming read cannot establish whether the PUT applied. */ }
  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, intent.id)).limit(1);
  if (job.status !== "succeeded") {
    await db.update(shippingWorkItems).set({ status: "review_required", lastError: "EDIT_UNCERTAIN", claimedBy: null, claimedAt: null })
      .where(and(eq(shippingWorkItems.id, intent.id), eq(shippingWorkItems.status, "processing")));
    throw new ShippingEditError("Shipment edit outcome is uncertain; carrier reads must confirm it before another edit");
  }
  return { linked: true, applied: patch };
}

export async function reconcileShippingEdit(orderId: number, runtime: BostaSyncRuntime | null) {
  if (!runtime?.canRead) throw new ShippingEditError("Verified carrier reads are required for edit reconciliation");
  const [ship] = await db.select().from(shipments).where(and(eq(shipments.orderId, orderId), eq(shipments.kind, "outgoing"))).limit(1);
  if (!ship) throw new ShippingEditError("Linked shipment not found");
  await recordShippingObservation(runtime, await runtime.read(ship.trackingNumber, ship.idempotencyKey));
  return true;
}
