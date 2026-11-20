import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { customers, deliveryAreas, orderItems, orders, productVariants, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { createOrderFromCheckout, quoteCheckout } from "../../src/modules/orders/orders.service.js";
import { cancelCustomerOrderRepo, expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { PromoRejectedError } from "../../src/modules/promos/promo-checkout.js";
import { getPromoAttentionRepo, getPromoCodeReportRepo } from "../../src/modules/promos/promo-report.repository.js";
import { getAdminAuthHeaders, getStaffAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

// Spec section 9.3: every number in a code's report comes from the orders that used it. Plus the whole feature in one run.
beforeEach(resetApiTestDatabase);

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "REPORT", codeNormalized: "REPORT", arName: "تقرير", enName: "Report", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: "percentage", discountValue: "10.000", eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}

async function customer(email: string) {
  const [row] = await db.insert(customers).values({ name: email.split("@")[0]!, email, passwordHash: "unused" }).$returningId();
  return row!.id;
}

async function place(customerId: number, phone: string, qty: number, promoCode = "report") {
  const ids = await getBaselineIds();
  return createOrderFromCheckout({ fullName: `Buyer ${customerId}`, phone, email: `buyer${customerId}-${qty}@capella.test`, areaId: ids.areaId,
    addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod", customerId, promoCode,
    items: [{ type: "product", variantId: ids.firstVariantId, qty }] }, { idempotencyKey: crypto.randomUUID() });
}

const fils = (value: string | number) => Math.round(Number(value) * 1000);

/** Three orders by two customers: one later denied, and a returning customer. */
async function scenario() {
  const ids = await getBaselineIds();
  const codeId = await code({ giftItemType: "product_variant", giftItemId: ids.secondVariantId, giftQty: 1 });
  const mona = await customer("mona@capella.test");
  const sara = await customer("sara@capella.test");
  // Sara bought before the code existed, so she is a returning customer.
  await db.insert(orders).values({ orderCode: "OLD-1", customerType: "registered", customerId: sara, fullName: "Sara", phone: "+96552223333",
    email: "sara@capella.test", governorate: "حولي", cityArea: "السالمية", addressLine: "Street", buildingApartment: "1", notes: "",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "5.000", createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) });
  const first = await place(mona, "51112222", 2);
  const second = await place(sara, "52223333", 1);
  const third = await place(mona, "51112222", 3);
  await updateOrderPaymentStatusRepo(second.id, "denied");
  return { codeId, ids, mona, sara, first, second, third };
}

test("money adds up from the orders still using the code: revenue, discount, delivery absorbed, gift cost and sales given up", async () => {
  const { codeId, first, third } = await scenario();
  const report = (await getPromoCodeReportRepo(codeId))!;
  const live = await db.select().from(orders).where(inArray(orders.id, [first.id, third.id]));
  const gifts = await db.select().from(orderItems).where(and(inArray(orderItems.orderId, [first.id, third.id]), eq(orderItems.isPromoGift, true)));

  assert.equal(report.money.revenueFils, live.reduce((sum, order) => sum + fils(order.totalAmount), 0));
  assert.equal(report.money.discountFils, live.reduce((sum, order) => sum + order.promoDiscountFils, 0));
  assert.ok(report.money.discountFils > 0);
  assert.equal(report.money.shippingAbsorbedFils, live.reduce((sum, order) => sum + order.promoShippingWaivedFils, 0));
  assert.equal(report.money.giftCostFils, gifts.reduce((sum, line) => sum + fils(line.snapshotBaseUnitPrice!) * line.qty, 0));
  assert.ok(report.money.giftCostFils > 0);
  assert.equal(report.money.saleGivenUpFils, 0);
  assert.equal(report.money.averageOrderFils, Math.round(live.reduce((sum, order) => sum + fils(order.totalAmount), 0) / live.length));
  const counted = (await db.select().from(orders)).filter((order) => order.paymentStatus !== "denied");
  assert.equal(report.money.storeAverageFils, Math.round(counted.reduce((sum, order) => sum + fils(order.totalAmount), 0) / counted.length));
});

test("uses, customers, orders and health come from the same orders", async () => {
  const { codeId, mona, sara, first, second, third } = await scenario();
  await db.update(promoCodes).set({ totalUsageLimit: 10 }).where(eq(promoCodes.id, codeId));
  const report = (await getPromoCodeReportRepo(codeId))!;

  assert.deepEqual(report.uses, { used: 2, released: 1, remaining: 8 });
  // Mona's first order with the code was her first order ever. Sara's use was given back when staff denied her order, so she is not counted.
  assert.deepEqual(report.customers.newVsReturning, { newCustomers: 1, returningCustomers: 0 });
  assert.equal(report.customers.byCustomer.find((row) => row.customerId === mona)!.uses, 2);
  assert.equal(report.customers.byCustomer.find((row) => row.customerId === sara)!.uses, 0);
  assert.deepEqual(report.orders.map((order) => order.id).sort(), [first.id, second.id, third.id].sort());
  assert.equal(report.orders.find((order) => order.id === second.id)!.useState, "released");
  assert.deepEqual(report.health.cancelled, { count: 1, total: 3 });
  assert.equal(report.health.usageByDay.reduce((sum, day) => sum + day.uses, 0), 2);
});

test("a customer who ordered before the code is counted as returning", async () => {
  const codeId = await code();
  const sara = await customer("returning@capella.test");
  await db.insert(orders).values({ orderCode: "OLD-2", customerType: "registered", customerId: sara, fullName: "Sara", phone: "+96554445555",
    email: "returning@capella.test", governorate: "حولي", cityArea: "السالمية", addressLine: "Street", buildingApartment: "1", notes: "",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "5.000", createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) });
  await place(sara, "54445555", 1);
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
  await code({ code: "FREE100", codeNormalized: "FREE100", discountValue: "100.000" });
  const mona = await customer("free@capella.test");
  const free = await place(mona, "53334444", 1, "free100");

  const attention = await getPromoAttentionRepo(now);
  assert.deepEqual(attention.endingSoon.map((row) => row.code), ["SOON"]);
  assert.deepEqual(attention.freeOrderReviews.map((row) => [row.orderId, row.codeText]), [[free.id, "FREE100"]]);
  await db.update(orders).set({ promoFreeReview: "resolved" });
  assert.deepEqual((await getPromoAttentionRepo(now)).freeOrderReviews, []);
});

test("one code with a discount, free delivery and a gift works end to end: denied, cancelled, expired and accepted", async () => {
  const ids = await getBaselineIds();
  const [baseline] = await db.select({ governorateId: deliveryAreas.governorateId }).from(deliveryAreas).where(eq(deliveryAreas.id, ids.areaId));
  const [{ id: areaId }] = await db.insert(deliveryAreas).values({ governorateId: baseline!.governorateId, arName: "حولي", enName: "Hawalli", fee: "2.000" }).$returningId();
  const codeId = await code({ code: "ALLIN", codeNormalized: "ALLIN", discountValue: "20.000", freeShipping: true,
    giftItemType: "product_variant", giftItemId: ids.secondVariantId, giftQty: 1, totalUsageLimit: 10 });
  const stockOf = async (variantId: number) => (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stockQty;
  const startFirst = await stockOf(ids.firstVariantId);
  const startGift = await stockOf(ids.secondVariantId);
  const order = (email: string) => {
    const payload = { fullName: "All In", phone: "55123456", email, areaId, addressLine: "Street 1", buildingApartment: "1",
      paymentMethod: "cod" as const, customerId: ids.customerId, promoCode: "allin", items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 1 }] };
    return quoteCheckout(payload).then((quote) => createOrderFromCheckout({ ...payload, expectedAmountFils: Math.round(quote.total * 1000) },
      { idempotencyKey: crypto.randomUUID() }));
  };

  const denied = await order("denied@capella.test");
  const cancelled = await order("cancelled@capella.test");
  const expired = await order("expired@capella.test");
  const kept = await order("kept@capella.test");
  assert.equal(await stockOf(ids.firstVariantId), startFirst - 4);
  assert.equal(await stockOf(ids.secondVariantId), startGift - 4);

  await updateOrderPaymentStatusRepo(denied.id, "denied");
  await cancelCustomerOrderRepo(cancelled.id, ids.customerId);
  await updateOrderPaymentStatusRepo(kept.id, "accepted");
  await expirePendingCodOrders(new Date(Date.now() + 200 * 60 * 60 * 1000));

  assert.equal(await stockOf(ids.firstVariantId), startFirst - 1);
  assert.equal(await stockOf(ids.secondVariantId), startGift - 1);
  const uses = await db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, codeId));
  const byOrder = new Map(uses.map((use) => [use.orderId, [use.state, use.releaseReason]]));
  assert.deepEqual(byOrder.get(denied.id), ["released", "denied"]);
  assert.deepEqual(byOrder.get(cancelled.id), ["released", "cancelled"]);
  assert.deepEqual(byOrder.get(expired.id), ["released", "expired"]);
  assert.deepEqual(byOrder.get(kept.id), ["used", null]);

  const [keptOrder] = await db.select().from(orders).where(eq(orders.id, kept.id));
  assert.equal(Number(keptOrder!.deliveryFee), 0);
  assert.equal(keptOrder!.promoShippingWaivedFils, 2000);
  const report = (await getPromoCodeReportRepo(codeId))!;
  assert.deepEqual(report.uses, { used: 1, released: 3, remaining: 9 });
  assert.equal(report.money.shippingAbsorbedFils, 2000);
  assert.equal(report.money.revenueFils, fils(keptOrder!.totalAmount));
});

test("a code limited to 5 uses gives exactly 5 under 25 checkouts at the same moment", async () => {
  const ids = await getBaselineIds();
  await db.update(productVariants).set({ stockQty: 100 }).where(eq(productVariants.id, ids.firstVariantId));
  await code({ code: "FIVE", codeNormalized: "FIVE", totalUsageLimit: 5 });
  const shoppers = await Promise.all(Array.from({ length: 25 }, async (_, index) => customer(`shopper${index}@capella.test`)));
  const results = await Promise.allSettled(shoppers.map((customerId, index) => createOrderFromCheckout({
    fullName: `Shopper ${index}`, phone: `5100${String(index).padStart(4, "0")}`, email: `shopper${index}@capella.test`, areaId: ids.areaId,
    addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod", customerId, promoCode: "five",
    items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] }, { idempotencyKey: crypto.randomUUID() })));

  const placed = results.filter((result) => result.status === "fulfilled");
  const refused = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.equal(placed.length, 5);
  assert.ok(refused.every((result) => result.reason instanceof PromoRejectedError && result.reason.rejection.reason === "usage_limit"),
    refused.map((result) => String(result.reason)).join("; "));
  assert.equal((await db.select().from(promoRedemptions).where(eq(promoRedemptions.state, "used"))).length, 5);
  const [row] = await db.select().from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  assert.equal(row!.stockQty, 95);
});
