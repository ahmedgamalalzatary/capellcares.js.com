import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipments, shippingWorkItems } from "@capella/database/drizzle/schema";
import { resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { recordShippingObservation } from "../../src/repositories/shipping-sync.repository.js";

beforeEach(resetApiTestDatabase);
async function guard(orderId: number, patch: unknown, evidence?: unknown) {
  const module = await import("../../src/repositories/shipping-state.repository.js");
  assert.ok((module as any).assertShippingEditAllowed, "atomic no-money shipping edit guard is required");
  return db.transaction(tx => (module as any).assertShippingEditAllowed(tx, orderId, patch, evidence));
}
test("only unfrozen pre-create orders can be edited without verified carrier availability", async () => {
  const f = await shippingSyncFixture(false);
  assert.deepEqual(await guard(f.order.id, { notes: "Changed" }), { notes: "Changed" });
  await db.update(shippingWorkItems).set({ status: "processing", requestSnapshot: "{}" }).where(eq(shippingWorkItems.id, f.job.id));
  await assert.rejects(guard(f.order.id, { notes: "Changed" }), /creation|uncertain|frozen/i);
});
test("linked edits require fresh verified pre-pickup availability and reject a later pickup even after state regression", async () => {
  const f = await shippingSyncFixture();
  const timeStamp = Date.now() - 20_000;
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 10, timeStamp })));
  const evidence = { verified: true, editable: true, prePickup: true, trackingNumber: "5108002", stateCode: 10, eventAtMs: timeStamp,
    accountId: f.runtime.accountId, environment: f.runtime.environment, businessReference: f.job.idempotencyKey };
  assert.deepEqual(await guard(f.order.id, { size: "large" }, evidence), { size: "large" });
  for (const invalid of [undefined, { ...evidence, verified: false }, { ...evidence, editable: false },
    { ...evidence, verified: "true" }, { ...evidence, editable: 1 }, { ...evidence, prePickup: "true" },
    { ...evidence, accountId: "different" }, { ...evidence, environment: "https://another.example/api/v2" }, { ...evidence, businessReference: "another" },
    { ...evidence, prePickup: false }, { ...evidence, trackingNumber: "other" }, { ...evidence, eventAtMs: timeStamp - 1 }]) {
    await assert.rejects(guard(f.order.id, { notes: "Changed" }, invalid), /verified|carrier|pickup/i);
  }
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 21, timeStamp: timeStamp + 1 })));
  await recordShippingObservation(f.runtime, f.runtime.parseWebhook(f.body({ state: 10, timeStamp: timeStamp + 2 })));
  await assert.rejects(guard(f.order.id, { notes: "Changed" }, { ...evidence, eventAtMs: timeStamp + 2 }), /pickup/i);
});
test("the guard locks customer amounts/items for COD and Paymob and blocks denied/refunded orders", async () => {
  const f = await shippingSyncFixture(false);
  for (const paymentMethod of ["cod", "paymob"] as const) {
    await db.update(orders).set({ paymentMethod, paymentStatus: "accepted", providerPaymentStatus: paymentMethod === "paymob" ? "succeeded" : null });
    for (const patch of [{ items: [] }, { qty: 1 }, { totalAmount: 132.29 }, { shippingAmountCents: 9729 }, { cod: 132.29 }]) {
      await assert.rejects(guard(f.order.id, patch));
    }
    assert.deepEqual(await guard(f.order.id, { notes: "Safe" }), { notes: "Safe" });
  }
  await db.update(orders).set({ refundedAmountCents: 13229 });
  await assert.rejects(guard(f.order.id, { notes: "Unsafe" }), /refund|locked/i);
  await db.update(orders).set({ paymentStatus: "denied", refundedAmountCents: 0 });
  await assert.rejects(guard(f.order.id, { notes: "Unsafe" }), /locked|denied/i);
});
