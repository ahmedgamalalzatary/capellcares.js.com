import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { checkoutShippingQuoteSchema } from "@capella/shared";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { applyShippingNoMoneyEdit, ShippingEditError } from "../../src/repositories/shipping-edit.repository.js";
import { BostaProviderError } from "../../src/modules/shipping/bosta/bosta-client.js";

beforeEach(resetApiTestDatabase);
const admin = () => createTestAdminUser({ name: "Edit admin", email: `edit-${crypto.randomUUID()}@example.test`, passwordHash: "unused", role: "admin" });
const currentOrder = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];
const snapshotAddress = (order: typeof orders.$inferSelect) => checkoutShippingQuoteSchema.parse(JSON.parse(order.shippingSnapshot)).address;

const fullPatch = (address: { cityId: string; zoneId: string; districtId: string }) => ({
  recipient: { fullName: "Edited Recipient", phone: "01012345678" },
  address: { cityId: address.cityId, zoneId: address.zoneId, districtId: address.districtId, addressLine: "Edited line", buildingApartment: "Edited building" },
  notes: "Edited notes", size: "medium" as const
});

test("unsent orders accept staff no-money edits on the order record without touching money", async () => {
  const f = await shippingSyncFixture(false);
  const actorId = await admin();
  const result = await applyShippingNoMoneyEdit(f.order.id, fullPatch(snapshotAddress(f.order)), actorId, null);
  assert.equal(result.linked, false);
  const order = await currentOrder(f.order.id);
  assert.equal(order.fullName, "Edited Recipient");
  assert.equal(order.phone, "01012345678");
  assert.equal(order.addressLine, "Edited line");
  assert.equal(order.buildingApartment, "Edited building");
  assert.equal(order.notes, "Edited notes");
  assert.equal(order.shippingSize, "medium");
  assert.equal(order.totalAmount, f.order.totalAmount);
  assert.equal(order.shippingAmountCents, f.order.shippingAmountCents);
  assert.equal(order.shippingSnapshot, f.order.shippingSnapshot);
  const request = f.provider.buildRequest(order, f.items, f.job.idempotencyKey);
  assert.equal(request.payload.specs.size, "MEDIUM");
  assert.equal(request.payload.dropOffAddress.firstLine, "Edited line, Edited building");
});

test("unsent edits refuse destination city/zone/district changes that would change shipping money", async () => {
  const f = await shippingSyncFixture(false);
  const patch = fullPatch({ cityId: "other-city", zoneId: "other-zone", districtId: "other-district" });
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, patch, await admin(), null),
    (error: unknown) => error instanceof ShippingEditError && /destination/i.test(error.message));
  const order = await currentOrder(f.order.id);
  assert.equal(order.fullName, f.order.fullName);
  assert.equal(order.shippingSize, "small");
});

test("linked shipments require a verified edit runtime and fresh matching carrier evidence", async () => {
  const f = await shippingSyncFixture(true);
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { size: "medium" }, await admin(), null),
    (error: unknown) => error instanceof ShippingEditError && /verified/i.test(error.message));
  const frozen = JSON.parse((await shippingWorkItemsMeta(f.order.id))[0]?.requestSnapshot ?? "null");
  let putCalls = 0;
  const edit = {
    sync: f.runtime,
    async read(trackingNumber: string, reference: string) {
      assert.equal(trackingNumber, f.shipment.trackingNumber);
      assert.equal(reference, f.shipment.idempotencyKey);
      return { observation: observation(f, putCalls > 0), editable: true, prePickup: true };
    },
    async update(trackingNumber: string, payload: Record<string, unknown>) {
      putCalls += 1;
      assert.equal(trackingNumber, f.shipment.trackingNumber);
      const jobs = await shippingWorkItemsMeta(f.order.id);
      assert.equal(jobs.find(job => String(job.operation) === "edit_delivery")?.status, "processing", "intent must exist before PUT");
      assert.deepEqual(payload, { notes: "Handle with care", specs: { size: "MEDIUM" } });
      return { trackingNumber, payload };
    }
  };
  const result = await applyShippingNoMoneyEdit(f.order.id, { size: "medium", notes: "Handle with care" }, await admin(), edit as never);
  assert.equal(result.linked, true);
  assert.equal(putCalls, 1);
  const [ship] = await db.select().from(shipments).where(eq(shipments.orderId, f.order.id));
  assert.equal(ship.size, "medium");
  assert.equal(JSON.parse(ship.carrierSnapshot!).notes, "Handle with care");
  const order = await currentOrder(f.order.id);
  assert.equal(order.shippingSize, "small");
});

async function shippingWorkItemsMeta(orderId: number) {
  const { shippingWorkItems } = await import("@capella/database/drizzle/schema");
  return db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, orderId));
}

test("stale or unverified carrier evidence blocks the linked edit before any provider write", async () => {
  const f = await shippingSyncFixture(true);
  await db.update(shipments).set({ providerEventAtMs: 5_000 }).where(eq(shipments.orderId, f.order.id));
  const frozen = JSON.parse((await shippingWorkItemsMeta(f.order.id))[0]?.requestSnapshot ?? "null");
  const base = {
    sync: f.runtime,
    async read() { return { observation: observation(f), editable: true, prePickup: true }; },
    async update() { throw new Error("Provider write must never happen"); }
  };
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { notes: "Late evidence" }, await admin(),
    { ...base, async read() { return { observation: { ...observation(f), atMs: 4_000 }, editable: true, prePickup: true }; } } as never),
    /verified|fresh|evidence/i);
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { notes: "Not editable" }, await admin(),
    { ...base, async read() { return { observation: observation(f), editable: false, prePickup: true }; } } as never),
    /verified|fresh|evidence/i);
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { notes: "Post pickup" }, await admin(),
    { ...base, async read() { return { observation: observation(f), editable: true, prePickup: false }; } } as never),
    /verified|fresh|evidence/i);
});

function observation(f: Awaited<ReturnType<typeof shippingSyncFixture>>, changed = false) {
  return { source: "read" as const, stateCode: 10, stateName: "Pickup requested", atMs: 5_000, type: "SEND",
    trackingNumber: f.shipment.trackingNumber, businessReference: f.shipment.idempotencyKey,
    collectedAmountCents: null, confirmedDelivery: false, exceptionCode: null,
    carrier: { notes: changed ? "Handle with care" : "Original", size: changed ? "MEDIUM" : "SMALL" }, raw: {} };
}

test("uncertain linked edits block another write and synchronization confirms them without resending", async () => {
  const f = await shippingSyncFixture();
  const actor = await admin();
  const edit = { sync: f.runtime, async read() { return { observation: observation(f), editable: true, prePickup: true }; },
    async update() { throw new Error("Connection lost after write"); } };
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { size: "medium", notes: "Handle with care" }, actor, edit), /uncertain|confirm/i);
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { notes: "Another edit" }, actor, edit), /pending|unresolved/i);
  const { requestShippingCancellation } = await import("../../src/repositories/shipping-cancellation.repository.js");
  await assert.rejects(requestShippingCancellation(f.order.id, { source: "staff", actorId: actor }), /edit|pending/i);
  const { recordShippingObservation } = await import("../../src/repositories/shipping-sync.repository.js");
  await recordShippingObservation(f.runtime, { ...observation(f, true), atMs: 6_000 });
  const jobs = await shippingWorkItemsMeta(f.order.id);
  assert.equal(jobs.find(job => String(job.operation) === "edit_delivery")?.status, "succeeded");
});

test("a definitively rejected delivery can be corrected and dispatched using a fresh request", async () => {
  const f = await shippingSyncFixture(false);
  const frozen = f.provider.buildRequest(f.order, f.items, f.job.idempotencyKey);
  await db.update(shippingWorkItems).set({ status: "failed", lastError: "CREATE_REJECTED", requestSnapshot: JSON.stringify(frozen) }).where(eq(shippingWorkItems.id, f.job.id));
  await applyShippingNoMoneyEdit(f.order.id, { notes: "Corrected", size: "medium" }, await admin(), null);
  const [job] = await shippingWorkItemsMeta(f.order.id);
  assert.equal(job.requestSnapshot, null);
  assert.equal(job.status, "failed");
});

test("a rejected read after successful PUT cannot authorize another write", async () => {
  const f = await shippingSyncFixture();
  const actor = await admin();
  let reads = 0;
  const edit = { sync: f.runtime, async read() {
    if (++reads > 1) throw new BostaProviderError("Read unavailable", "definitive", 404);
    return { observation: observation(f), editable: true, prePickup: true };
  }, async update() { return { success: true }; } };
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { notes: "Handle with care" }, actor, edit), /uncertain/i);
  const jobs = await shippingWorkItemsMeta(f.order.id);
  assert.equal(jobs.find(job => String(job.operation) === "edit_delivery")?.status, "review_required");
});

test("a repeated carrier snapshot still confirms an idempotent edit", async () => {
  const f = await shippingSyncFixture();
  const edit = { sync: f.runtime, async read() { return { observation: observation(f), editable: true, prePickup: true }; },
    async update() { return { success: true }; } };
  await applyShippingNoMoneyEdit(f.order.id, { notes: "Original" }, await admin(), edit);
  const jobs = await shippingWorkItemsMeta(f.order.id);
  assert.equal(jobs.find(job => String(job.operation) === "edit_delivery")?.status, "succeeded");
});

test("carrier evidence closes a rejected edit after the requested correction is applied in Bosta", async () => {
  const f = await shippingSyncFixture();
  const edit = { sync: f.runtime, async read() { return { observation: observation(f), editable: true, prePickup: true }; },
    async update() { throw new BostaProviderError("Edit unavailable", "definitive", 400); } };
  await assert.rejects(applyShippingNoMoneyEdit(f.order.id, { size: "medium", notes: "Handle with care" }, await admin(), edit), /rejected/i);
  const { recordShippingObservation } = await import("../../src/repositories/shipping-sync.repository.js");
  await recordShippingObservation(f.runtime, { ...observation(f, true), atMs: 6_000 });
  const jobs = await shippingWorkItemsMeta(f.order.id);
  assert.equal(jobs.find(job => String(job.operation) === "edit_delivery")?.status, "succeeded");
});
