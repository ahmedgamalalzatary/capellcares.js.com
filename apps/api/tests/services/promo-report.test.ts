import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { customers, orderItems, orderReviewFlags, orders, promoCodes } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { createOrderFromCheckout } from "../../src/modules/orders/orders.service.js";
import { updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { getPromoCodeReportRepo, getPromoAttentionRepo } from "../../src/modules/promos/promo-report.repository.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

// Phase 7 (spec section 9.3): every number in a code's report comes from the orders that used it.
beforeEach(resetApiTestDatabase);

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "REPORT", codeNormalized: "REPORT", arName: "تقرير", enName: "Report", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.00", eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}

async function customer(email: string) {
  const [row] = await db.insert(customers).values({ name: email.split("@")[0]!, email, passwordHash: "unused" }).$returningId();
  return row!.id;
}

async function place(customerId: number, phone: string, qty: number, extraItems: Array<{ type: "product"; variantId: number; qty: number }> = []) {
  const ids = await getBaselineIds();
  return createOrderFromCheckout({ fullName: `Buyer ${customerId}`, phone, email: `buyer${customerId}-${qty}@capella.test`, governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod", customerId, promoCode: "report",
    items: [{ type: "product", variantId: ids.firstVariantId, qty }, ...extraItems] }, { idempotencyKey: crypto.randomUUID() });
}

/** Three orders by two customers: one later denied, one partly refunded, and a returning customer. */
async function scenario() {
  const ids = await getBaselineIds();
  const codeId = await code({ giftItemType: "product_variant", giftItemId: ids.secondVariantId, giftQty: 1 });
  const mona = await customer("mona@capella.test");
  const sara = await customer("sara@capella.test");
  // Sara bought before the code existed, so she is a returning customer.
  await db.insert(orders).values({ orderCode: "OLD-1", customerType: "registered", customerId: sara, fullName: "Sara", phone: "+201022223333",
    email: "sara@capella.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1", notes: "",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "50.00", createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
  const first = await place(mona, "01011112222", 2);
  const second = await place(sara, "01022223333", 1);
  const third = await place(mona, "01011112222", 3);
  await updateOrderPaymentStatusRepo(second.id, "denied");
  await db.update(orders).set({ refundedAmountCents: 1000 }).where(eq(orders.id, third.id));
  return { codeId, ids, mona, sara, first, second, third };
}

test("money adds up from the orders still using the code: revenue net of refunds, discount, delivery absorbed, gift cost and sales given up", async () => {
  const { codeId, first, third } = await scenario();
  const report = (await getPromoCodeReportRepo(codeId))!;
  const live = await db.select().from(orders).where(inArray(orders.id, [first.id, third.id]));
  const gifts = await db.select().from(orderItems).where(and(inArray(orderItems.orderId, [first.id, third.id]), eq(orderItems.isPromoGift, true)));
  const cents = (value: string | number) => Math.round(Number(value) * 100);

  assert.equal(report.money.revenueCents, live.reduce((sum, order) => sum + cents(order.totalAmount) - order.refundedAmountCents, 0));
  assert.equal(report.money.discountCents, live.reduce((sum, order) => sum + order.promoDiscountCents, 0));
  assert.equal(report.money.shippingAbsorbedCents, live.reduce((sum, order) => sum + order.promoShippingWaivedCents, 0));
  assert.equal(report.money.giftCostCents, gifts.reduce((sum, line) => sum + cents(line.snapshotBaseUnitPrice!) * line.qty, 0));
  assert.ok(report.money.giftCostCents > 0);
  assert.equal(report.money.saleGivenUpCents, 0);
  assert.equal(report.money.averageOrderCents, Math.round(live.reduce((sum, order) => sum + cents(order.totalAmount), 0) / live.length));
  const store = await db.select().from(orders);
  const counted = store.filter((order) => order.paymentStatus !== "denied");
  assert.equal(report.money.storeAverageCents, Math.round(counted.reduce((sum, order) => sum + cents(order.totalAmount), 0) / counted.length));
});

test("uses, customers, orders and health come from the same orders", async () => {
  const { codeId, mona, sara, first, second, third } = await scenario();
  await db.update(promoCodes).set({ totalUsageLimit: 10 }).where(eq(promoCodes.id, codeId));
  const report = (await getPromoCodeReportRepo(codeId))!;

  assert.deepEqual(report.uses, { used: 2, reserved: 0, released: 1, overLimit: 0, remaining: 8 });
  // Mona's first order with the code was her first order ever. Sara's use was given back when staff denied her order, so she is not counted.
  assert.deepEqual(report.customers.newVsReturning, { newCustomers: 1, returningCustomers: 0 });
  const monaRow = report.customers.byCustomer.find((row) => row.customerId === mona)!;
  const saraRow = report.customers.byCustomer.find((row) => row.customerId === sara)!;
  assert.equal(monaRow.uses, 2);
  assert.equal(saraRow.uses, 0);
  assert.deepEqual(report.orders.map((order) => order.id).sort(), [first.id, second.id, third.id].sort());
  assert.equal(report.orders.find((order) => order.id === second.id)!.useState, "released");
  assert.deepEqual(report.health.cancelled, { count: 1, total: 3 });
  assert.deepEqual(report.health.refunded, { count: 1, total: 3 });
  assert.equal(report.health.usageByDay.reduce((sum, day) => sum + day.uses, 0), 2);
});

test("a customer who ordered before the code is counted as returning", async () => {
  const codeId = await code();
  const sara = await customer("returning@capella.test");
  await db.insert(orders).values({ orderCode: "OLD-2", customerType: "registered", customerId: sara, fullName: "Sara", phone: "+201044445555",
    email: "returning@capella.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1", notes: "",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "50.00", createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
  await place(sara, "01044445555", 1);
  assert.deepEqual((await getPromoCodeReportRepo(codeId))!.customers.newVsReturning, { newCustomers: 0, returningCustomers: 1 });
});

test("the report endpoint needs promos.read and answers 404 for a missing code", async () => {
  const codeId = await code();
  await withTestServer(app, async (request) => {
    const admin = await getAdminAuthHeaders(request);
    const response = await request(`/api/erp/promo-codes/${codeId}/report`, { headers: admin });
    assert.equal(response.status, 200, JSON.stringify(response.json));
    assert.equal(response.json.uses.used, 0);
    assert.equal((await request("/api/erp/promo-codes/999999/report", { headers: admin })).status, 404);
    const none = await getStaffAuthHeaders(request);
    assert.equal((await request(`/api/erp/promo-codes/${codeId}/report`, { headers: none })).status, 403);
    const reader = await getStaffAuthHeaders(request, { permissionKeys: ["promos.read"] });
    assert.equal((await request(`/api/erp/promo-codes/${codeId}/report`, { headers: reader })).status, 200);
  });
});

test("the dashboard lists free orders waiting for review and running codes that end within a week", async () => {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  await code({ code: "SOON", codeNormalized: "SOON", endsAt: new Date(now.getTime() + 2 * day) });
  await code({ code: "LATER", codeNormalized: "LATER", endsAt: new Date(now.getTime() + 30 * day) });
  await code({ code: "PAUSED", codeNormalized: "PAUSED", status: "paused", endsAt: new Date(now.getTime() + day) });
  const freeId = await code({ code: "FREE100", codeNormalized: "FREE100", discountValue: "100.00" });
  const mona = await customer("free@capella.test");
  const ids = await getBaselineIds();
  const free = await createOrderFromCheckout({ fullName: "Free", phone: "01033334444", email: "free@capella.test", governorate: "Cairo",
    cityArea: "Nasr City", addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod", customerId: mona, promoCode: "free100",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] }, { idempotencyKey: crypto.randomUUID() });

  const attention = await getPromoAttentionRepo(now);
  assert.deepEqual(attention.endingSoon.map((row) => row.code), ["SOON"]);
  assert.deepEqual(attention.freeOrderReviews.map((row) => [row.orderId, row.codeText]), [[free.id, "FREE100"]]);
  assert.ok(freeId);
  await db.update(orderReviewFlags).set({ status: "resolved" });
  assert.deepEqual((await getPromoAttentionRepo(now)).freeOrderReviews, []);
});
