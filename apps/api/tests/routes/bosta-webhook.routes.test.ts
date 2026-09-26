import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@capella/database/src/db";
import { orders, shipmentEvents } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { syncEnvironment } from "../helpers/bosta-sync.js";
import { shippingWorkItems } from "@capella/database/drizzle/schema";

beforeEach(resetApiTestDatabase);
async function configured(run: () => Promise<void>, enabled = true) {
  const previous = Object.fromEntries(Object.keys(syncEnvironment).map(key => [key, process.env[key]]));
  Object.assign(process.env, syncEnvironment, { BOSTA_ENABLED: "false", BOSTA_SYNC_ENABLED: String(enabled) });
  try { await run(); } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
const path = "/api/v1/shipping/bosta/webhook";
const headers = { "content-type": "application/json", "X-Bosta-Webhook-Secret": syncEnvironment.BOSTA_WEBHOOK_SECRET };

test("Bosta callback authenticates before parsing or storing a body", async () => {
  await configured(async () => withTestServer(app, async request => {
    const response = await request(path, { method: "POST", headers: { "content-type": "application/json" }, body: "{invalid" });
    assert.equal(response.status, 401);
    assert.equal((await db.select().from(shipmentEvents)).length, 0);
  }));
});
test("disabled Bosta sync rejects callbacks without storing events", async () => {
  await configured(async () => withTestServer(app, async request => {
    assert.equal((await request(path, { method: "POST", headers, body: "{}" })).status, 503);
  }), false);
});
test("Bosta callback bounds bodies and rejects malformed or invalid events", async () => {
  await configured(async () => withTestServer(app, async request => {
    for (const [body, status] of [["{invalid", 400], [JSON.stringify({ data: "x".repeat(50_000) }), 413], ["{}", 422]] as const) {
      assert.equal((await request(path, { method: "POST", headers, body })).status, status);
    }
    assert.equal((await db.select().from(shipmentEvents)).length, 0);
  }));
});
test("authenticated callback persists matching COD evidence once while provider HTTP is off", async () => {
  const f = await shippingSyncFixture();
  const body = JSON.stringify(f.body());
  await configured(async () => withTestServer(app, async request => {
    for (let i = 0; i < 2; i++) assert.equal((await request(path, { method: "POST", headers, body })).status, 200);
  }));
  assert.equal((await db.select().from(shipmentEvents)).length, 1);
  const [order] = await db.select().from(orders).where(eq(orders.id, f.order.id));
  assert.equal(order.paymentStatus, "accepted");
});
test("unrelated callbacks are acknowledged without importing shipments", async () => {
  const f = await shippingSyncFixture();
  await configured(async () => withTestServer(app, async request => {
    assert.equal((await request(path, { method: "POST", headers, body: JSON.stringify(f.body({ trackingNumber: "unknown", businessReference: "unknown" })) })).status, 202);
  }));
  assert.equal((await db.select().from(shipmentEvents)).length, 0);
});
test("authenticated early callback is durably acknowledged pending shipment linking", async () => {
  const f = await shippingSyncFixture(false);
  const request = f.provider.buildRequest(f.order, f.items, f.job.idempotencyKey);
  await db.update(shippingWorkItems).set({ requestSnapshot: JSON.stringify(request) }).where(eq(shippingWorkItems.id, f.job.id));
  await configured(async () => withTestServer(app, async send => {
    assert.equal((await send(path, { method: "POST", headers, body: JSON.stringify(f.body()) })).status, 202);
  }));
  const [event] = await db.select().from(shipmentEvents);
  assert.equal(event.shipmentId, null);
  assert.equal(event.processedAt, null);
});
