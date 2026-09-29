import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, orderItems, orderReviewFlags, shippingWorkItems, productVariants } from "@capella/database/drizzle/schema";
import { createTestAdminUser, resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { recordOrderManualState } from "../../src/repositories/shipping-state.repository.js";
import { runShippingDispatchOnce } from "../../src/modules/shipping/shipping-dispatch-worker.js";
import { expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/repositories/order.repository.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";

beforeEach(resetApiTestDatabase);
async function api() {
  const service = await import("../../src/repositories/shipping-cancellation.repository.js").catch(() => null);
  assert.ok(service?.requestShippingCancellation, "shared durable cancellation operation is required");
  return service;
}
const admin = () => createTestAdminUser({ name: "Cancel admin", email: "cancel@example.test", passwordHash: "unused", role: "admin" });
const order = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];
const stock = async (id: number) => (await db.select().from(productVariants).where(eq(productVariants.id, id)))[0].stockQty;
const jobs = (id: number) => db.select().from(shippingWorkItems).where(and(eq(shippingWorkItems.orderId, id), eq(shippingWorkItems.operation, "cancel_delivery")));

test("safe unsent cancellation is durable, stops creation and restores stock exactly once across concurrent requests", async () => {
  const f = await shippingSyncFixture(false);
  const service = await api();
  const actorId = await admin();
  const results = await Promise.all([1, 2].map(() => service.requestShippingCancellation(f.order.id, { source: "staff", actorId, reason: "Customer request" })));
  assert.equal(results[0].status, "cancelled");
  assert.equal(results[1].status, "cancelled");
  assert.equal((await jobs(f.order.id)).length, 1);
  assert.equal((await order(f.order.id)).cancellationStatus, "cancelled");
  assert.equal((await order(f.order.id)).paymentStatus, "denied");
  assert.equal(await stock(f.ids.firstVariantId), 10);
  await runShippingDispatchOnce({ provider: f.provider });
  assert.equal((await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.id, f.job.id)))[0].status, "failed");
});

test("customer cancellation enforces signed-in ownership and staff cancellation requires an active explicit grant", async () => {
  const f = await shippingSyncFixture(false);
  const service = await api();
  await assert.rejects(service.requestShippingCancellation(f.order.id, { source: "customer", actorId: f.ids.customerId }), /not found/i);
  await db.update(orders).set({ customerType: "registered", customerId: f.ids.customerId }).where(eq(orders.id, f.order.id));
  await assert.rejects(service.requestShippingCancellation(f.order.id, { source: "customer", actorId: f.ids.customerId + 1 }), /not found/i);
  const staff = await createTestAdminUser({ name: "No grant", email: "cancel-staff@example.test", passwordHash: "unused" });
  await assert.rejects(service.requestShippingCancellation(f.order.id, { source: "staff", actorId: staff }), /permission/i);
  await assert.rejects(service.requestShippingCancellation(f.order.id, { source: "refund", actorId: staff }), /invalid|source/i);
  assert.equal((await jobs(f.order.id)).length, 0);
  assert.equal(await stock(f.ids.firstVariantId), 9);
  const result = await service.requestShippingCancellation(f.order.id, { source: "customer", actorId: f.ids.customerId });
  assert.equal(result.status, "cancelled");
});

test("staff cancellation follows the catalog grant shipping.update_state instead of the retired shipping.cancel key", async () => {
  const f = await shippingSyncFixture(false);
  const staff = await createTestAdminUser({ name: "Shipping staff", email: "cancel-grant@example.test", passwordHash: "unused", role: "staff" });
  const { syncPermissionCatalog, replaceAdminUserPermissions } = await import("../../src/services/erp-permissions.service.js");
  await syncPermissionCatalog();
  await replaceAdminUserPermissions(staff, ["orders.read", "shipping.read", "shipping.update_state"]);
  const result = await (await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId: staff, reason: "Customer request" });
  assert.equal(result.status, "cancelled");
  assert.equal(await stock(f.ids.firstVariantId), 10);
});

test("historical printing blocks direct cancellation even after staff switch back to Preparing", async () => {
  const f = await shippingSyncFixture(false);
  const actorId = await admin();
  await recordOrderManualState(f.order.id, { state: "printed" }, actorId);
  await recordOrderManualState(f.order.id, { state: "preparing" }, actorId);
  await assert.rejects((await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId }), /printing|custody|pickup/i);
  assert.equal(await stock(f.ids.firstVariantId), 9);
});

test("linked cancellation stays pending with stock held and prevents staff processing", async () => {
  const f = await shippingSyncFixture();
  const actorId = await admin();
  const result = await (await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId });
  assert.equal(result.status, "pending");
  assert.equal((await order(f.order.id)).paymentStatus, "pending");
  assert.equal(await stock(f.ids.firstVariantId), 9);
  await assert.rejects(recordOrderManualState(f.order.id, { state: "preparing" }, actorId), /cancell|locked/i);
});

test("safe paid cancellation restores stock immediately while retaining payment and the full manual refund due", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(orders).set({ paymentMethod: "paymob", paymentStatus: "accepted", providerPaymentStatus: "succeeded" }).where(eq(orders.id, f.order.id));
  const result = await (await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId: await admin() });
  assert.equal(result.status, "cancelled");
  assert.equal(result.refundRequiredCents, 13229);
  assert.equal((await order(f.order.id)).paymentStatus, "accepted");
  assert.equal((await order(f.order.id)).refundedAmountCents, 0);
  assert.equal(await stock(f.ids.firstVariantId), 10);
  assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.flagType, "refund_review"))).length, 1);
});

test("cancellation restores sold bundle components instead of later catalog contents", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(orderItems).set({ itemType: "offer", variantId: null, offerId: f.ids.offerId,
    qty: 1, snapshotComponents: JSON.stringify([{ variantId: f.ids.firstVariantId, qty: 1 }]) }).where(eq(orderItems.orderId, f.order.id));
  await (await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId: await admin() });
  assert.equal(await stock(f.ids.firstVariantId), 10);
  assert.equal(await stock(f.ids.secondVariantId), 6);
});

test("existing expiry starts the shared linked cancellation intent and retains stock until custody is proven", async () => {
  const f = await shippingSyncFixture();
  await expirePendingCodOrders(new Date(f.order.codExpiresAt!.getTime() + 1000));
  await expirePendingCodOrders(new Date(f.order.codExpiresAt!.getTime() + 2000));
  assert.equal((await order(f.order.id)).cancellationStatus, "pending");
  assert.equal((await jobs(f.order.id)).length, 1);
  assert.equal(await stock(f.ids.firstVariantId), 9);
});

test("existing safe staff rejection records the same cancellation and stock effect", async () => {
  const f = await shippingSyncFixture(false);
  await updateOrderPaymentStatusRepo(f.order.id, "denied");
  assert.equal((await order(f.order.id)).cancellationStatus, "cancelled");
  assert.equal((await jobs(f.order.id)).length, 1);
  assert.equal(await stock(f.ids.firstVariantId), 10);
});

test("a saved successful create response cannot be treated as an unsent failure when cancellation is requested", async () => {
  const f = await shippingSyncFixture(false);
  await db.update(shippingWorkItems).set({ status: "failed", responseSnapshot: JSON.stringify({ trackingNumber: "5108002",
    rawProviderCode: 10, rawProviderState: "Pickup requested", rawResponse: {} }) }).where(eq(shippingWorkItems.id, f.job.id));
  const result = await (await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId: await admin() });
  assert.equal(result.status, "pending");
  assert.equal(await stock(f.ids.firstVariantId), 9);
  await runShippingDispatchOnce({ provider: null });
  const { shipments } = await import("@capella/database/drizzle/schema");
  assert.equal((await db.select().from(shipments))[0]?.trackingNumber, "5108002");
});

test("verified COD collection during pending cancellation remains paid independently of cancellation and stock", async () => {
  const f = await shippingSyncFixture();
  await (await api()).requestShippingCancellation(f.order.id, { source: "staff", actorId: await admin() });
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body()));
  const stored = await order(f.order.id);
  assert.equal(stored.cancellationStatus, "pending");
  assert.equal(stored.paymentStatus, "accepted");
  assert.equal(await stock(f.ids.firstVariantId), 9);
  assert.equal((await db.select().from(orderReviewFlags).where(eq(orderReviewFlags.flagType, "custody_review"))).length, 1);
});
