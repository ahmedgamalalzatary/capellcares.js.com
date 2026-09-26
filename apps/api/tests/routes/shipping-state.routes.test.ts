import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, productVariants } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase, createTestAdminUser } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { recordOrderManualState } from "../../src/repositories/shipping-state.repository.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";
import { findOrderByIdRepo, listOrdersRepo } from "../../src/repositories/order.repository.js";

beforeEach(resetApiTestDatabase);
test("admin order detail shows manual, carrier, payment, collection and custody independently", async () => {
  const f = await shippingSyncFixture();
  const actorId = await createTestAdminUser({ name: "Admin", email: "state-display@example.test", passwordHash: "unused", role: "admin" });
  await recordOrderManualState(f.order.id, { state: "delivered", reason: "Staff report" }, actorId);
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 41, cod: undefined, isConfirmedDelivery: undefined })));
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/orders/${f.order.id}`, { headers: auth });
    assert.equal(response.status, 200);
    assert.equal(response.json.shipping?.manualState, "delivered");
    assert.equal(response.json.shipping.carrierState, "in_transit");
    assert.equal(response.json.shipping.rawProviderType, "SEND");
    assert.equal(response.json.shipping.custodyState, "carrier");
    assert.equal(response.json.shipping.collection.confirmed, false);
    assert.equal(response.json.paymentStatus, "pending");
    assert.equal(response.json.shipping.history[0].actorId, actorId);
    assert.equal(response.json.shipping.history[0].reason, "Staff report");
    assert.equal(response.json.shipping.processing.untouchedExpiryApplies, false);
  });
});
test("staff payment changes cannot bypass Bosta evidence or silently include money/item edits", async () => {
  const f = await shippingSyncFixture(false);
  await withTestServer(app, async request => {
    const auth = await getAdminAuthHeaders(request);
    const send = (body: unknown, id = String(f.order.id)) => request(`/api/erp/orders/${id}/payment-status`, {
      method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await send({ paymentStatus: "accepted" })).status, 409);
    assert.equal((await send({ paymentStatus: "denied", items: [], totalAmount: 0 })).status, 400);
    assert.equal((await send({ paymentStatus: "denied" }, `${f.order.id}junk`)).status, 400);
  });
  assert.equal((await db.select().from(orders))[0].paymentStatus, "pending");
  assert.equal((await db.select().from(productVariants).where(eq(productVariants.id, f.ids.firstVariantId)))[0].stockQty, 9);
});
test("order read permission remains enforced for new state details", async () => {
  const f = await shippingSyncFixture();
  await withTestServer(app, async request => {
    assert.equal((await request(`/api/erp/orders/${f.order.id}`)).status, 401);
    const auth = await getStaffAuthHeaders(request);
    assert.equal((await request(`/api/erp/orders/${f.order.id}`, { headers: { authorization: auth.authorization } })).status, 403);
  });
});
test("customer reads preserve ownership and do not expose internal staff processing fields", async () => {
  const f = await shippingSyncFixture();
  await db.update(orders).set({ customerType: "registered", customerId: f.ids.customerId, manualShippingState: "preparing", shippingProcessingAtMs: Date.now() });
  const detail = await findOrderByIdRepo(f.order.id, { customerId: f.ids.customerId });
  const list = await listOrdersRepo({ customerId: f.ids.customerId, withItems: true });
  for (const order of [detail, list[0]]) {
    for (const key of ["manualShippingState", "shippingProcessingAtMs", "shippingPickupAtMs", "shippingAddressBlockedAtMs", "shipping"]) assert.equal(Object.hasOwn(order!, key), false, key);
  }
  assert.equal(await findOrderByIdRepo(f.order.id, { customerId: f.ids.customerId + 99999 }), null);
});
