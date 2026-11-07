import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { createOrderWithItems } from "../../../src/modules/orders/order.repository.js";
import { notifyStaffOfNewOrder } from "../../../src/modules/orders/order-alert.js";
import { getBaselineIds, resetApiTestDatabase } from "../../helpers/database.js";

beforeEach(async () => {
  await resetApiTestDatabase();
});

const env = { OPENWA_URL: "http://openwa:2785", OPENWA_API_KEY: "k", OPENWA_SESSION_ID: "s", STAFF_WHATSAPP_NUMBER: "201000000000", ERP_PUBLIC_URL: "https://erp.example.com" };

test("notifyStaffOfNewOrder sends a saved order's code, customer, items, shipping, total and payment way", async () => {
  const ids = await getBaselineIds();
  const created = await createOrderWithItems({
    order: {
      customerType: "guest", customerId: null, fullName: "Mona Adel", phone: "01011112222", email: "m@capella.test",
      governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1", notes: "",
      paymentMethod: "cod", paymentStatus: "pending", totalAmount: 120, shippingAmountCents: 5000
    },
    items: [{ variantId: ids.firstVariantId, qty: 2, unitPrice: 35, lineTotal: 70, snapshotNameAr: "سيروم", snapshotNameEn: "Serum", snapshotSizeLabel: "30ml" }]
  } as any);

  let text = "";
  const sent = await notifyStaffOfNewOrder(created.id, {
    env,
    fetchFn: async (_url, init) => {
      text = JSON.parse(String(init!.body)).text;
      return new Response("{}", { status: 201 });
    }
  });

  assert.equal(sent, true);
  assert.match(text, new RegExp(created.orderCode));
  assert.match(text, /Mona Adel/);
  assert.match(text, /سيروم \(30ml\) × 2/);
  assert.match(text, /الدفع: عند الاستلام/);
  assert.match(text, new RegExp(`/orders/${created.id}`));
});

test("notifyStaffOfNewOrder never throws for an order that does not exist", async () => {
  assert.equal(await notifyStaffOfNewOrder(999999, { env, fetchFn: async () => new Response("{}", { status: 201 }) }), false);
});
