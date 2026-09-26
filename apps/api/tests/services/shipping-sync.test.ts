import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderItems, shipments, shipmentEvents, shippingWorkItems, productVariants, orderReviewFlags } from "@capella/database/drizzle/schema";
import { resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { readFixture, syncEnvironment } from "../helpers/bosta-sync.js";
import { resolveBostaSyncRuntime } from "../../src/modules/shipping/bosta/bosta-sync.service.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";

beforeEach(resetApiTestDatabase);
async function service() {
  const module = await import("../../src/repositories/shipping-sync.repository.js").catch(() => null);
  assert.ok(module?.recordShippingObservation, "transactional carrier event processing is required");
  return module;
}

test("confirmed matching delivered COD is paid once without altering stock, customer snapshots, Paymob evidence or manual state", async () => {
  const fixture = await shippingSyncFixture();
  await db.update(shipments).set({ manualState: "preparing" });
  const api = await service();
  const event = fixture.runtime.parseWebhook(fixture.body());
  await Promise.all([api.recordShippingObservation(fixture.runtime, event), api.recordShippingObservation(fixture.runtime, event)]);
  const [order] = await db.select().from(orders);
  const [ship] = await db.select().from(shipments);
  assert.equal(order.paymentStatus, "accepted");
  assert.equal(order.providerPaymentStatus, null);
  assert.equal(order.totalAmount, "132.29");
  assert.equal(order.shippingSnapshot, fixture.order.shippingSnapshot);
  assert.equal(ship.rawProviderCode, 45);
  assert.equal(ship.normalizedState, "delivered");
  assert.equal(ship.collectedAmountCents, 13229);
  assert.equal(ship.manualState, "preparing");
  assert.equal((await db.select().from(shipmentEvents)).length, 1);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, fixture.ids.firstVariantId)))[0].stockQty, 9);
  assert.deepEqual(await db.select().from(orderItems), fixture.items);
});

test("mismatched COD remains unpaid and duplicate events do not duplicate staff flags", async () => {
  const fixture = await shippingSyncFixture();
  const api = await service();
  const event = fixture.runtime.parseWebhook(fixture.body({ cod: 35 }));
  await api.recordShippingObservation(fixture.runtime, event);
  await api.recordShippingObservation(fixture.runtime, event);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  const flags = await db.select().from(orderReviewFlags);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].flagType, "amount_mismatch");
  assert.equal((await db.select().from(shipments))[0].collectedAmountCents, 3500);
});

test("older events remain in audit history without regressing delivery or paid evidence", async () => {
  const fixture = await shippingSyncFixture();
  const api = await service();
  const atMs = Date.now() - 10_000;
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body({ timeStamp: atMs })));
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body({ state: 24, timeStamp: atMs - 1 })));
  assert.equal((await db.select().from(shipments))[0].normalizedState, "delivered");
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
  const events = await db.select().from(shipmentEvents);
  assert.equal(events.length, 2);
  assert.equal(events[1].processingError, "STALE_EVENT");
  assert.ok(events[1].processedAt);
});

test("different states with the same timestamp require staff reconciliation rather than numeric state ordering", async () => {
  const fixture = await shippingSyncFixture();
  const api = await service();
  const timeStamp = Date.now() - 10_000;
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body({ state: 24, timeStamp })));
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body({ state: 21, timeStamp })));
  assert.equal((await db.select().from(shipments))[0].rawProviderCode, 24);
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "custody_review");
  assert.equal((await db.select().from(shipmentEvents))[1].processingError, "CONFLICTING_EVENT");
});

test("Bosta edits are saved on the shipment while order details, quote, items and customer total remain unchanged", async () => {
  const fixture = await shippingSyncFixture();
  const runtime = resolveBostaSyncRuntime(syncEnvironment, async () => Response.json(readFixture(fixture.job.idempotencyKey)))!;
  await (await service()).recordShippingObservation(runtime, await runtime.read("5108002", fixture.job.idempotencyKey));
  const [order] = await db.select().from(orders);
  const [ship] = await db.select().from(shipments);
  const carrier = JSON.parse(ship.carrierSnapshot!);
  assert.equal(carrier.notes, "Carrier notes");
  assert.equal(carrier.address.firstLine, "Carrier address");
  assert.equal(carrier.size, "MEDIUM");
  assert.equal(carrier.requestedCodAmountCents, 15000);
  for (const field of ["fullName", "phone", "addressLine", "buildingApartment", "notes", "totalAmount", "shippingSize", "shippingSnapshot"] as const) {
    assert.equal(order[field], fixture.order[field]);
  }
  assert.equal(ship.size, "small");
  assert.deepEqual(await db.select().from(orderItems), fixture.items);
});

test("delivered status without confirmed collection evidence cannot mark COD paid", async () => {
  const fixture = await shippingSyncFixture();
  const api = await service();
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body({ isConfirmedDelivery: false })));
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "custody_review");
});

test("a webhook arriving before shipment linking is durably recovered afterwards, even with provider reads disabled", async () => {
  const fixture = await shippingSyncFixture(false);
  const request = fixture.provider.buildRequest(fixture.order, fixture.items, fixture.job.idempotencyKey);
  await db.update(shippingWorkItems).set({ requestSnapshot: JSON.stringify(request) });
  const runtime = resolveBostaSyncRuntime({ ...syncEnvironment, BOSTA_ENABLED: "false" })!;
  const api = await service();
  assert.equal(await api.recordShippingObservation(runtime, runtime.parseWebhook(fixture.body())), "pending");
  assert.equal((await db.select().from(shipmentEvents))[0].shipmentId, null);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  await runShippingDispatchOnce({ provider: fixture.provider });
  await api.processPendingShippingEvents(runtime);
  assert.equal((await db.select().from(shipmentEvents))[0].shipmentId, (await db.select().from(shipments))[0].id);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
});

test("unrelated tracking/reference or another merchant account cannot import or update a delivery", async () => {
  const fixture = await shippingSyncFixture();
  const api = await service();
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body({ trackingNumber: "unrelated", businessReference: "unrelated" })));
  const other = { ...fixture.runtime, accountId: "other", accountKey: "other" };
  await api.recordShippingObservation(other, other.parseWebhook(fixture.body()));
  assert.equal((await db.select().from(shipmentEvents)).length, 0);
  assert.equal((await db.select().from(shipments)).length, 1);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
});

test("refund/rejection and Paymob payment evidence are never overwritten by carrier delivery", async () => {
  const fixture = await shippingSyncFixture();
  const api = await service();
  await db.update(orders).set({ paymentMethod: "paymob", providerPaymentStatus: "refunded", refundedAmountCents: 13229, paymentStatus: "accepted" });
  await api.recordShippingObservation(fixture.runtime, fixture.runtime.parseWebhook(fixture.body()));
  const [order] = await db.select().from(orders);
  assert.equal(order.providerPaymentStatus, "refunded");
  assert.equal(order.refundedAmountCents, 13229);
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "custody_review");
});

test("same-time conflicting collection amounts cannot silently turn an unpaid order into paid", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const timeStamp = Date.now() - 10_000;
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp, cod: 35 })));
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp })));
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  assert.equal((await db.select().from(shipments))[0].collectedAmountCents, 3500);
  assert.equal((await db.select().from(shipmentEvents))[1].processingError, "CONFLICTING_EVENT");
});
test("a later inconsistent report flags staff and retains an already paid order", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const timeStamp = Date.now() - 10_000;
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp })));
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp: timeStamp + 1, cod: 35 })));
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "amount_mismatch");
  assert.equal((await db.select().from(shipments))[0].collectedAmountCents, 3500);
});

test("newer transit and created reports preserve verified COD collection and flag reconciliation once", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const timeStamp = Date.now() - 10_000;
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp })));
  for (const [index, state] of [41, 10].entries()) {
    const event = f.runtime.parseWebhook(f.body({ state, timeStamp: timeStamp + index + 1, cod: undefined, isConfirmedDelivery: undefined }));
    await api.recordShippingObservation(f.runtime, event);
    await api.recordShippingObservation(f.runtime, event);
    const [ship] = await db.select().from(shipments);
    assert.equal(ship.collectedAmountCents, 13229);
    assert.equal(ship.collectionConfirmed, true);
    assert.equal(ship.rawProviderCode, state);
    assert.equal(ship.normalizedState, index === 0 ? "in_transit" : "created");
    assert.equal(ship.custodyState, index === 0 ? "carrier" : "unknown");
    assert.equal(ship.providerEventAtMs, timeStamp + index + 1);
    assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
    const flags = await db.select().from(orderReviewFlags);
    assert.equal(flags.length, 1);
    assert.equal(flags[0].flagType, "custody_review");
    const runtime = resolveBostaSyncRuntime(syncEnvironment, async () => Response.json(readFixture(f.job.idempotencyKey, {
      state: { code: state, value: "Current carrier state" }, updatedAt: new Date(timeStamp + index + 1).toISOString(),
      cod: 132.29, collection: { amount: null, confirmed: false }, notes: `Carrier refresh ${state}`
    })))!;
    await api.recordShippingObservation(runtime, await runtime.read("5108002", f.job.idempotencyKey));
    const [refreshed] = await db.select().from(shipments);
    assert.equal(refreshed.collectedAmountCents, 13229);
    assert.equal(refreshed.collectionConfirmed, true);
    assert.equal(JSON.parse(refreshed.carrierSnapshot!).notes, `Carrier refresh ${state}`);
  }
  const events = await db.select().from(shipmentEvents);
  assert.equal(events.length, 5);
  assert.equal(JSON.parse(events[1].rawPayload).collectedAmountCents, null);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});
test("unlinked early events cannot starve a later event ready for local replay", async () => {
  const f = await shippingSyncFixture(false);
  const api = await service();
  const frozen = f.provider.buildRequest(f.order, f.items, f.job.idempotencyKey);
  await db.update(shippingWorkItems).set({ requestSnapshot: JSON.stringify(frozen) }).where(eq(shippingWorkItems.id, f.job.id));
  for (let i = 0; i < 10; i++) await api.recordShippingObservation(f.runtime,
    f.runtime.parseWebhook(f.body({ trackingNumber: `unlinked-${i}` })));
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body()));
  await runShippingDispatchOnce({ provider: f.provider });
  await api.processPendingShippingEvents(f.runtime, 10);
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
});

test("return, cancellation, loss and address trouble never restore stock or fabricate COD payment", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const atMs = Date.now() - 20_000;
  for (const [index, changes] of [{ state: 46, type: "RTO" }, { state: 49 }, { state: 100 }, { state: 47, exceptionCode: 5 }].entries()) {
    await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ ...changes, timeStamp: atMs + index })));
  }
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
  assert.deepEqual((await db.select().from(orderReviewFlags)).map(row => row.flagType).sort(), ["address_review", "custody_review"]);
});

test("same-time withdrawn confirmation is flagged while missing proof does not contradict saved evidence", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const timeStamp = Date.now() - 10_000;
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp })));
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp, isConfirmedDelivery: undefined })));
  assert.equal((await db.select().from(orderReviewFlags)).length, 0);
  await api.recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ timeStamp, isConfirmedDelivery: false })));
  assert.equal((await db.select().from(orders))[0].paymentStatus, "accepted");
  assert.equal((await db.select().from(orderReviewFlags))[0]?.flagType, "custody_review");
  assert.equal((await db.select().from(shipmentEvents))[2].processingError, "CONFLICTING_EVENT");
});
