import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { app } from "../../src/app.js";
import { db } from "@capella/database/src/db";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { offerItems, orderItems, orders, productVariants } from "@capella/database/drizzle/schema";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  await resetApiTestDatabase();
});

test("erp sales aggregates direct product orders, offer orders, and all payment statuses", async () => {
  const ids = await getBaselineIds();

  const [deniedOrder] = await db.insert(orders).values({
    orderCode: "SALE-001",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Denied Customer",
    phone: "01011111111",
    email: "denied@capella.test",
    governorate: "Cairo",
    cityArea: "Nasr City",
    addressLine: "Street 1",
    buildingApartment: "Building 1",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "denied",
    totalAmount: "70.00"
  }).$returningId();

  await db.insert(orderItems).values({
    orderId: deniedOrder.id,
    itemType: "product_variant",
    variantId: ids.firstVariantId,
    offerId: null,
    qty: 2,
    unitPrice: "35.00",
    lineTotal: "70.00",
    snapshotNameAr: "منتج تجريبي 1",
    snapshotNameEn: "Baseline Product 1",
    snapshotSizeLabel: "100ml"
  });

  const [acceptedOrder] = await db.insert(orders).values({
    orderCode: "SALE-002",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Accepted Customer",
    phone: "01022222222",
    email: "accepted@capella.test",
    governorate: "Cairo",
    cityArea: "Maadi",
    addressLine: "Street 2",
    buildingApartment: "Building 2",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "accepted",
    totalAmount: "70.00"
  }).$returningId();

  await db.insert(orderItems).values({
    orderId: acceptedOrder.id,
    itemType: "offer",
    variantId: null,
    offerId: ids.offerId,
    qty: 1,
    unitPrice: "70.00",
    lineTotal: "70.00",
    snapshotNameAr: "عرض تجريبي",
    snapshotNameEn: "Baseline Offer",
    snapshotSizeLabel: null
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/sales", {
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.summary.totalOrders, 2);
    assert.equal(response.json.summary.totalUnitsSold, 4);
    assert.equal(response.json.summary.totalRevenue, 140);

    const productOne = response.json.productTotals.find((item: any) => item.productId === ids.productOneId);
    const productTwo = response.json.productTotals.find((item: any) => item.productId === ids.productTwoId);
    assert.ok(productOne);
    assert.ok(productTwo);
    assert.equal(productOne.unitsSold, 3);
    assert.equal(productTwo.unitsSold, 1);

    // Offer revenue is the actual paid bundle price (lineTotal), allocated across components,
    // so per-variant revenue reconciles with totalRevenue rather than summing catalog prices.
    const variantRevenueSum = response.json.variantTotals.reduce((sum: number, item: any) => sum + item.revenue, 0);
    assert.ok(
      Math.abs(variantRevenueSum - response.json.summary.totalRevenue) < 0.01,
      `variant revenue ${variantRevenueSum} should reconcile with totalRevenue ${response.json.summary.totalRevenue}`
    );

    const firstVariant = response.json.variantTotals.find((item: any) => item.variantId === ids.firstVariantId);
    const secondVariant = response.json.variantTotals.find((item: any) => item.variantId === ids.secondVariantId);
    assert.ok(firstVariant);
    assert.ok(secondVariant);
    assert.equal(firstVariant.unitsSold, 3);
    assert.equal(secondVariant.unitsSold, 1);

    const denied = response.json.orders.find((item: any) => item.orderId === deniedOrder.id);
    const accepted = response.json.orders.find((item: any) => item.orderId === acceptedOrder.id);
    assert.equal(denied.paymentStatus, "denied");
    assert.equal(accepted.paymentStatus, "accepted");
    assert.equal(denied.unitsSold, 2);
    assert.equal(accepted.unitsSold, 2);
  });
});

test("erp sales expands offer quantities using underlying offer item quantities", async () => {
  const ids = await getBaselineIds();

  await db.update(offerItems).set({ qty: 2 }).where(eq(offerItems.offerId, ids.offerId));
  await db.update(productVariants).set({ stockQty: 20 }).where(eq(productVariants.id, ids.firstVariantId));
  await db.update(productVariants).set({ stockQty: 20 }).where(eq(productVariants.id, ids.secondVariantId));

  const [pendingOrder] = await db.insert(orders).values({
    orderCode: "SALE-003",
    customerType: "registered",
    customerId: ids.customerId,
    fullName: "Pending Customer",
    phone: "01033333333",
    email: "pending@capella.test",
    governorate: "Giza",
    cityArea: "Dokki",
    addressLine: "Street 3",
    buildingApartment: "Building 3",
    notes: "",
    paymentMethod: "cod",
    paymentStatus: "pending",
    totalAmount: "140.00"
  }).$returningId();

  await db.insert(orderItems).values({
    orderId: pendingOrder.id,
    itemType: "offer",
    variantId: null,
    offerId: ids.offerId,
    qty: 2,
    unitPrice: "70.00",
    lineTotal: "140.00",
    snapshotNameAr: "عرض تجريبي",
    snapshotNameEn: "Baseline Offer",
    snapshotSizeLabel: null
  });

  await withTestServer(app, async (request) => {
    const authHeaders = await getAdminAuthHeaders(request);
    const response = await request("/api/erp/sales", {
      headers: { ...authHeaders }
    });

    assert.equal(response.status, 200);
    assert.equal(response.json.summary.totalOrders, 1);
    assert.equal(response.json.summary.totalUnitsSold, 8);

    const firstVariant = response.json.variantTotals.find((item: any) => item.variantId === ids.firstVariantId);
    const secondVariant = response.json.variantTotals.find((item: any) => item.variantId === ids.secondVariantId);
    assert.equal(firstVariant.unitsSold, 4);
    assert.equal(secondVariant.unitsSold, 4);

    const orderBreakdown = response.json.orders.find((item: any) => item.orderId === pendingOrder.id);
    assert.equal(orderBreakdown.unitsSold, 8);
  });
});
