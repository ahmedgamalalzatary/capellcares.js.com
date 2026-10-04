import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderStateHistory, shipments, shipmentEvents, shippingWorkItems, orderReviewFlags, productVariants } from "@capella/database/drizzle/schema";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { syncEnvironment } from "../helpers/bosta-sync.js";
import { recordShippingObservation, processPendingShippingEvents } from "../../src/modules/shipping/shipping-sync.repository.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";
import { updateOrderPaymentStatusRepo, expirePendingCodOrders } from "../../src/modules/orders/order.repository.js";

beforeEach(resetApiTestDatabase);
async function service() {
  const module = await import("../../src/modules/shipping/shipping-state.repository.js").catch(() => null);
  assert.ok(module?.recordOrderManualState, "transactional manual/processing state service is required");
  return module;
}
const actor = () => createTestAdminUser({ name: "Shipping admin", email: "shipping-state@example.test", passwordHash: "unused", role: "admin" });
const currentOrder = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];

test("invalid edit settings disable editing without breaking linked order details", async t => {
  const f = await shippingSyncFixture();
  const api = await service();
  const env = { ...syncEnvironment, BOSTA_EDITS_ENABLED: "true", BOSTA_EDIT_SETTINGS_JSON: "{}" };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, env);
  const state = await api.getOrderShippingState(f.order);
  assert.equal(state.editEnabled, false);
  assert.deepEqual(state.editFields, [], "invalid settings must advertise no editable field");
  assert.equal(state.carrierState, "created");
  assert.equal(state.packingSize, "small");
  const settings = {
    accountVerified: true, accountEvidence: "controlled fixture only", accountId: "fixture",
    readContract: { verified: true, evidence: "controlled fixture only", editablePath: ["editable"], prePickupPath: ["prePickup"] }
  };
  process.env.BOSTA_EDIT_SETTINGS_JSON = JSON.stringify(settings);
  const verifiedState = await api.getOrderShippingState(f.order);
  assert.equal(verifiedState.editEnabled, true);
  assert.deepEqual(verifiedState.editFields, ["recipientPhone", "address"], "documented fields need no extra evidence");
  process.env.BOSTA_EDIT_SETTINGS_JSON = JSON.stringify({ ...settings,
    fields: { notes: { verified: true, evidence: "controlled fixture only" } } });
  assert.deepEqual((await api.getOrderShippingState(f.order)).editFields, ["recipientPhone", "address", "notes"],
    "a field with verified evidence is advertised");
});

test("pre-link staff preparation records actor/time once, stops untouched eligibility and survives shipment linking", async () => {
  const f = await shippingSyncFixture(false);
  const api = await service();
  const actorId = await actor();
  const atMs = Date.now() - 10_000;
  await api.recordOrderManualState(f.order.id, { state: "preparing", reason: "Packing" }, actorId, { now: new Date(atMs) });
  await api.recordOrderManualState(f.order.id, { state: "preparing" }, actorId);
  const order = await currentOrder(f.order.id);
  assert.equal(order.manualShippingState, "preparing");
  assert.equal(order.shippingProcessingAtMs, atMs);
  assert.equal(order.paymentStatus, "pending");
  const history = await db.select().from(orderStateHistory);
  assert.equal(history.length, 1);
  assert.equal(history[0].actorId, actorId);
  assert.equal(history[0].eventAtMs, atMs);
  assert.equal((await api.getOrderShippingState(order)).processing.untouchedExpiryApplies, false);
  await runShippingDispatchOnce({ provider: f.provider });
  assert.equal((await db.select().from(shipments))[0].manualState, "preparing");
});
test("manual delivery never fabricates carrier state, COD proof, custody or sellable stock, and manual Returned is retired", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const actorId = await actor();
  // D08/S13: returns are reported by Bosta; staff can no longer write Returned manually.
  await assert.rejects(api.recordOrderManualState(f.order.id, { state: "returned" }, actorId), /invalid|enum|returned/i);
  await api.recordOrderManualState(f.order.id, { state: "delivered" }, actorId);
  const ship = (await db.select().from(shipments))[0];
  assert.equal(ship.manualState, "delivered");
  assert.equal(ship.normalizedState, "created");
  assert.equal(ship.custodyState, "unknown");
  assert.equal(ship.collectionConfirmed, false);
  assert.equal((await currentOrder(f.order.id)).paymentStatus, "pending");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
  assert.equal((await db.select().from(orderStateHistory)).length, 1);
});
test("manual states reject unknown/inactive actors, denied orders and attempts to change money", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  await assert.rejects(api.recordOrderManualState(f.order.id, { state: "preparing" }, 999999), /permission|authorized/i);
  const inactive = await createTestAdminUser({ name: "Inactive", email: "inactive-state@example.test", passwordHash: "unused", role: "admin", isActive: false });
  await assert.rejects(api.recordOrderManualState(f.order.id, { state: "preparing" }, inactive), /permission|authorized/i);
  const staffId = await createTestAdminUser({ name: "Unpermitted", email: "unpermitted-state@example.test", passwordHash: "unused" });
  await assert.rejects(api.recordOrderManualState(f.order.id, { state: "preparing" }, staffId), /permission|authorized/i);
  const actorId = await actor();
  await assert.rejects(api.recordOrderManualState(f.order.id, { state: "preparing", totalAmount: 0 }, actorId));
  await db.update(orders).set({ paymentStatus: "denied" }).where(eq(orders.id, f.order.id));
  await assert.rejects(api.recordOrderManualState(f.order.id, { state: "preparing" }, actorId), /locked|denied/i);
  assert.equal((await db.select().from(orderStateHistory)).length, 0);
});
test("genuine carrier pickup is recorded even when its event arrives after a newer address exception", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const actorId = await actor();
  const atMs = Date.now() - 20_000;
  await api.recordOrderManualState(f.order.id, { state: "preparing" }, actorId, { now: new Date(atMs) });
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 47, exceptionCode: 5, timeStamp: atMs + 10 })));
  let order = await currentOrder(f.order.id);
  assert.equal(order.shippingAddressBlockedAtMs, atMs + 10);
  assert.equal((await api.getOrderShippingState(order)).processing.untouchedExpiryApplies, true);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 21, timeStamp: atMs + 5 })));
  order = await currentOrder(f.order.id);
  assert.equal(order.shippingPickupAtMs, atMs + 5);
  assert.equal(order.shippingAddressBlockedAtMs, null);
  assert.equal((await api.getOrderShippingState(order)).processing.untouchedExpiryApplies, false);
  assert.equal((await db.select().from(shipments))[0].rawProviderCode, 47);
  assert.equal((await db.select().from(shipmentEvents))[1].processingError, "STALE_EVENT");
});
test("delivery creation, route assignment, notes and size changes alone never count as processing", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  await recordShippingObservation(f.runtime, { ...f.runtime.parseWebhook(f.body({ state: 20 })), carrier: { notes: "Edited", size: "MEDIUM" } });
  const order = await currentOrder(f.order.id);
  assert.equal(order.shippingProcessingAtMs, null);
  assert.equal(order.shippingPickupAtMs, null);
  assert.equal((await api.getOrderShippingState(order)).processing.untouchedExpiryApplies, true);
});
test("return transit on a linked outgoing shipment preserves pickup protection after a later address exception", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const timeStamp = Date.now() - 10_000;
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 41, type: "RTO", timeStamp })));
  assert.equal((await db.select().from(shipments))[0].custodyState, "carrier");
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 47, type: "RTO", exceptionCode: 13, timeStamp: timeStamp + 1 })));
  const order = await currentOrder(f.order.id);
  assert.equal(order.shippingPickupAtMs, timeStamp);
  assert.equal(order.shippingAddressBlockedAtMs, null);
  assert.equal((await api.getOrderShippingState(order)).processing.untouchedExpiryApplies, false);
});
test("verified delivery and return custody stay independent of unpaid COD and restock approval", async () => {
  const f = await shippingSyncFixture();
  await service();
  const timeStamp = Date.now() - 10_000;
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ cod: 35, timeStamp })));
  assert.equal((await db.select().from(shipments))[0].custodyState, "recipient");
  assert.equal((await currentOrder(f.order.id)).paymentStatus, "pending");
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 46, type: "RTO", timeStamp: timeStamp + 1 })));
  assert.equal((await db.select().from(shipments))[0].custodyState, "warehouse_uninspected");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});
test("existing processed event history is replayed locally once without changing payment or manual state", async () => {
  const f = await shippingSyncFixture();
  await service();
  const event = f.runtime.parseWebhook(f.body({ state: 21 }));
  await recordShippingObservation(f.runtime, event);
  await db.update(orders).set({ shippingProcessingAtMs: null, shippingPickupAtMs: null }).where(eq(orders.id, f.order.id));
  await db.update(shipmentEvents).set({ stateRecordedAt: null });
  assert.equal(await processPendingShippingEvents(f.runtime), 1);
  assert.equal((await currentOrder(f.order.id)).shippingPickupAtMs, event.atMs);
  assert.equal(await processPendingShippingEvents(f.runtime), 0);
  assert.equal((await currentOrder(f.order.id)).paymentStatus, "pending");
});
test("shipping COD cannot bypass verified collection using the existing staff payment operation", async () => {
  const f = await shippingSyncFixture(false);
  await assert.rejects(updateOrderPaymentStatusRepo(f.order.id, "accepted"), /Bosta|collection/i);
  assert.equal((await currentOrder(f.order.id)).paymentStatus, "pending");
});
test("prepared unsent orders retain stock at expiry but safe staff rejection still restores it once", async () => {
  const f = await shippingSyncFixture(false);
  const api = await service();
  await api.recordOrderManualState(f.order.id, { state: "preparing" }, await actor());
  await db.update(orders).set({ codExpiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, f.order.id));
  await expirePendingCodOrders(new Date());
  assert.equal((await currentOrder(f.order.id)).paymentStatus, "pending");
  await updateOrderPaymentStatusRepo(f.order.id, "denied");
  await assert.rejects(updateOrderPaymentStatusRepo(f.order.id, "denied"), /locked/i);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 10);
});
test("printed or manually delivered unsent orders require custody review before rejection", async () => {
  const f = await shippingSyncFixture(false);
  const api = await service();
  const actorId = await actor();
  await api.recordOrderManualState(f.order.id, { state: "printed" }, actorId);
  await assert.rejects(updateOrderPaymentStatusRepo(f.order.id, "denied"), /custody/i);
  await api.recordOrderManualState(f.order.id, { state: "preparing" }, actorId);
  await assert.rejects(updateOrderPaymentStatusRepo(f.order.id, "denied"), /custody/i);
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});

test("preparation racing expiry ends either safely prepared or safely denied, never prepared with restored stock", async () => {
  const f = await shippingSyncFixture(false);
  const api = await service();
  const actorId = await actor();
  await db.update(orders).set({ codExpiresAt: new Date(Date.now() - 1000) }).where(eq(orders.id, f.order.id));
  await Promise.allSettled([expirePendingCodOrders(new Date()), api.recordOrderManualState(f.order.id, { state: "preparing" }, actorId)]);
  const order = await currentOrder(f.order.id);
  const stock = (await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty;
  if (order.manualShippingState === "preparing") {
    assert.equal(order.paymentStatus, "pending");
    assert.equal(stock, 9);
  } else {
    assert.equal(order.paymentStatus, "denied");
    assert.equal(stock, 10);
    assert.equal((await db.select().from(orderStateHistory)).length, 0);
  }
});
test("current pre-pickup address trouble retains the fixed deadline and cannot be cleared by ordinary staff preparation", async () => {
  const f = await shippingSyncFixture();
  const api = await service();
  const actorId = await actor();
  const before = f.order.codExpiresAt!.getTime();
  const timeStamp = Date.now() - 10_000;
  await api.recordOrderManualState(f.order.id, { state: "ready_for_pickup" }, actorId);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 47, exceptionCode: 13, timeStamp })));
  await api.recordOrderManualState(f.order.id, { state: "preparing" }, actorId);
  const order = await currentOrder(f.order.id);
  assert.equal(order.codExpiresAt!.getTime(), before);
  assert.equal((await api.getOrderShippingState(order)).processing.untouchedExpiryApplies, true);
  assert.equal((await db.select().from(orderReviewFlags))[0].flagType, "address_review");
});

test("prepared orders remain dispatchable after the untouched deadline without changing that deadline", async () => {
  const f = await shippingSyncFixture(false);
  const api = await service();
  await api.recordOrderManualState(f.order.id, { state: "preparing" }, await actor());
  const deadline = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000);
  await db.update(orders).set({ codExpiresAt: deadline }).where(eq(orders.id, f.order.id));
  await runShippingDispatchOnce({ provider: f.provider });
  assert.equal((await db.select().from(shipments)).length, 1);
  assert.equal((await currentOrder(f.order.id)).codExpiresAt!.getTime(), deadline.getTime());
});
