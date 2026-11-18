import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

import { db } from "@capella/database/src/db";
import {
  customers,
  orderItems,
  orderReviewFlags,
  orders,
  productVariants,
  promoCodeCustomers,
  promoCodes,
  promoCodeTargets,
  promoRedemptions,
  variantDiscounts
} from "@capella/database/drizzle/schema";
import { app } from "../../src/app.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { PromoRejectedError } from "../../src/modules/promos/promo-checkout.js";
import { createTestAdminUser, getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { shippingSyncFixture } from "../helpers/shipping-sync.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(resetApiTestDatabase);

type CodeOverrides = Partial<typeof promoCodes.$inferInsert> & { include?: Array<{ type: "category" | "product" | "variant" | "offer" | "collection"; id: number }> };

async function createCode(overrides: CodeOverrides = {}) {
  const { include, ...columns } = overrides;
  const text = (columns.code ?? "SAVE10").toUpperCase();
  const [row] = await db.insert(promoCodes).values({
    arName: "خصم", enName: "Save", status: "active", startsAt: new Date(Date.now() - 60_000),
    discountType: "percentage", discountValue: "10.00", eligibilityScope: include ? "selected" : "all",
    ...columns, code: text, codeNormalized: text
  }).$returningId();
  if (include) await db.insert(promoCodeTargets).values(include.map((target) => ({ promoCodeId: row!.id, targetType: target.type, targetId: target.id, mode: "include" as const })));
  return row!.id;
}

const variantPrice = async (variantId: number) =>
  Number((await db.select({ price: productVariants.sellingPrice }).from(productVariants).where(eq(productVariants.id, variantId)))[0]!.price);
const stock = async (variantId: number) =>
  (await db.select({ stock: productVariants.stockQty }).from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stock;
const redemptions = (codeId: number) => db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, codeId));

async function buyer(overrides: Record<string, unknown> = {}) {
  const ids = await getBaselineIds();
  return {
    ids,
    payload: {
      fullName: "Promo Buyer", phone: "01012345678", email: "promo-buyer@capella.test", governorate: "Cairo", cityArea: "Nasr City",
      addressLine: "Street 1", buildingApartment: "Building 2", paymentMethod: "cod" as const, customerId: ids.customerId,
      promoCode: "save10", items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 2 }],
      ...overrides
    }
  };
}

test("priceCheckout takes the code off eligible lines and reports it, leaving other lines at their price", async () => {
  const { ids, payload } = await buyer({ items: [{ type: "product", variantId: (await getBaselineIds()).firstVariantId, qty: 2 }, { type: "product", variantId: (await getBaselineIds()).secondVariantId, qty: 1 }] });
  await createCode({ include: [{ type: "variant", id: ids.firstVariantId }] });
  const first = await variantPrice(ids.firstVariantId);
  const second = await variantPrice(ids.secondVariantId);

  const priced = await priceCheckout(payload);
  assert.equal(priced.promo?.dto.status, "applied");
  assert.equal(priced.items[0].lineTotal, Math.round(first * 2 * 0.9 * 100) / 100);
  assert.equal(priced.items[0].promoDiscountAmount, Math.round(first * 2 * 0.1 * 100) / 100);
  assert.equal(priced.items[1].lineTotal, second);
  assert.equal(Math.round(priced.totalAmount * 100), Math.round((first * 2 * 0.9 + second) * 100));
});

test("a guest's code is refused with a login prompt and the cart keeps its prices", async () => {
  const { ids, payload } = await buyer({ customerId: null });
  await createCode();
  const priced = await priceCheckout(payload);
  assert.deepEqual(priced.promo?.dto, { status: "rejected", code: "SAVE10", reason: "login_required" });
  assert.equal(priced.items[0].lineTotal, (await variantPrice(ids.firstVariantId)) * 2);
});

test("the code replaces a sale on the pieces it discounts and reports the new price for confirmation", async () => {
  const { ids, payload } = await buyer({ items: [{ type: "product", variantId: (await getBaselineIds()).firstVariantId, qty: 1 }] });
  const [sale] = await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "30.00",
    startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), status: "active" }).$returningId();
  await createCode({ discountValue: "10.00" });
  const original = await variantPrice(ids.firstVariantId);

  const priced = await priceCheckout(payload);
  assert.equal(priced.items[0].unitPrice, original);
  assert.equal(priced.items[0].lineTotal, Math.round(original * 0.9 * 100) / 100);
  assert.equal(priced.items[0].promoReplacedDiscountId, sale!.id);
  const dto = priced.promo?.dto;
  assert.ok(dto && dto.status === "applied");
  assert.equal(dto.replacedSales.length, 1);
  assert.equal(dto.replacedSales[0]!.previousLineTotal, Math.round(original * 0.7 * 100) / 100);
});

test("a COD order with a code stores the code, the paid line totals and one used redemption under the normalized phone", async () => {
  const { ids, payload } = await buyer();
  const codeId = await createCode();
  const price = await variantPrice(ids.firstVariantId);

  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  assert.equal(order!.promoCodeId, codeId);
  assert.equal(order!.promoCodeText, "SAVE10");
  assert.equal(order!.promoDiscountCents, Math.round(price * 2 * 10));
  assert.equal(Number(order!.totalAmount), Math.round(price * 2 * 0.9 * 100) / 100);
  const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, created.id));
  assert.equal(Number(item!.lineTotal), Number(order!.totalAmount));
  assert.equal(Number(item!.promoDiscountAmount), Math.round(price * 2 * 0.1 * 100) / 100);
  const uses = await redemptions(codeId);
  assert.deepEqual(uses.map((use) => [use.state, use.orderId, use.customerId, use.phoneNormalized]), [["used", created.id, ids.customerId, "+201012345678"]]);
});

test("a single-use code taken by two checkouts at once is used exactly once; the other is told the limit was reached", async () => {
  const { ids, payload } = await buyer({ items: [{ type: "product", variantId: (await getBaselineIds()).firstVariantId, qty: 1 }] });
  const codeId = await createCode({ totalUsageLimit: 1 });
  const before = await stock(ids.firstVariantId);

  const results = await Promise.allSettled([1, 2].map(() => createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() })));
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0]!.reason instanceof PromoRejectedError);
  assert.equal((rejected[0]!.reason as PromoRejectedError).rejection.reason, "usage_limit");
  assert.equal((await redemptions(codeId)).length, 1);
  assert.equal(await stock(ids.firstVariantId), before - 1);
});

test("the per-customer limit also counts uses under the same phone, so a re-created account cannot reuse the code", async () => {
  const { payload } = await buyer();
  const codeId = await createCode({ perCustomerLimit: 1 });
  await db.insert(promoRedemptions).values({ promoCodeId: codeId, customerId: null, phoneNormalized: "+201012345678", state: "used" });
  await assert.rejects(createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() }),
    (error: unknown) => error instanceof PromoRejectedError && error.rejection.reason === "customer_limit");
});

test("a code that stopped applying is refused at checkout without creating an order or touching stock", async () => {
  const { ids, payload } = await buyer();
  await createCode({ status: "paused" });
  const before = await stock(ids.firstVariantId);
  await assert.rejects(createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() }),
    (error: unknown) => error instanceof PromoRejectedError && error.rejection.reason === "inactive");
  assert.equal((await db.select().from(orders)).length, 0);
  assert.equal(await stock(ids.firstVariantId), before);
});

test("first-order and private codes check the account and the checkout phone", async () => {
  const { ids, payload } = await buyer();
  await createCode({ code: "WELCOME", firstOrderOnly: true });
  const first = await createOrderFromCheckout({ ...payload, promoCode: "welcome" }, { idempotencyKey: crypto.randomUUID() });
  assert.ok(first.id);
  await assert.rejects(createOrderFromCheckout({ ...payload, promoCode: "welcome" }, { idempotencyKey: crypto.randomUUID() }),
    (error: unknown) => error instanceof PromoRejectedError && error.rejection.reason === "first_order");

  const privateId = await createCode({ code: "VIP", isPrivate: true });
  assert.equal((await priceCheckout({ ...payload, promoCode: "vip" })).promo?.dto.reason, "private");
  await db.insert(promoCodeCustomers).values({ promoCodeId: privateId, customerId: ids.customerId });
  assert.equal((await priceCheckout({ ...payload, promoCode: "vip" })).promo?.dto.status, "applied");
});

test("staff denying a COD order gives the code use back, so a single-use code works again", async () => {
  const { payload } = await buyer();
  const codeId = await createCode({ totalUsageLimit: 1 });
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await updateOrderPaymentStatusRepo(created.id, "denied");
  assert.deepEqual((await redemptions(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "denied"]]);
  assert.ok((await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() })).id);
});

test("a COD order expiring after 96 hours gives the code use back", async () => {
  const { payload } = await buyer();
  const codeId = await createCode();
  await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await expirePendingCodOrders(new Date(Date.now() + 97 * 60 * 60 * 1000));
  assert.deepEqual((await redemptions(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "expired"]]);
});

test("a completed shipping cancellation gives the code use back", async () => {
  const fixture = await shippingSyncFixture(false);
  const codeId = await createCode();
  await db.insert(promoRedemptions).values({ promoCodeId: codeId, customerId: fixture.ids.customerId, orderId: fixture.order.id, state: "used" });
  const { requestShippingCancellation } = await import("../../src/modules/shipping/shipping-cancellation.repository.js");
  const actorId = await createTestAdminUser({ name: "Admin", email: "promo-cancel@capella.test", passwordHash: "unused", role: "admin" });
  await requestShippingCancellation(fixture.order.id, { source: "staff", actorId, reason: "Customer request" });
  assert.deepEqual((await redemptions(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "cancelled"]]);
});

test("a code that makes the order free is accepted and flagged for staff review", async () => {
  const { payload } = await buyer();
  await createCode({ discountType: "fixed", discountValue: "100000.00" });
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  assert.equal(Number(order!.totalAmount), 0);
  assert.equal(order!.paymentStatus, "accepted");
  const flags = await db.select().from(orderReviewFlags).where(and(eq(orderReviewFlags.orderId, created.id), eq(orderReviewFlags.flagType, "promo_free_review")));
  assert.equal(flags.length, 1);
});

test("the storefront price endpoint returns every line, the products total and the code outcome", async () => {
  const { ids } = await buyer();
  await createCode();
  const price = await variantPrice(ids.firstVariantId);
  const token = jwt.sign({ sub: ids.customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
  await withTestServer(app, async (request) => {
    const body = JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], promoCode: " save10 " });
    const signedIn = await request("/api/v1/checkout/price", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body });
    assert.equal(signedIn.status, 200, JSON.stringify(signedIn.json));
    assert.equal(signedIn.json.promo.status, "applied");
    assert.equal(signedIn.json.productsTotal, Math.round(price * 0.9 * 100) / 100);
    assert.deepEqual(signedIn.json.items[0], { index: 0, unitPrice: price, originalUnitPrice: price, lineTotal: Math.round(price * 0.9 * 100) / 100, promoDiscount: Math.round(price * 0.1 * 100) / 100 });

    const guest = await request("/api/v1/checkout/price", { method: "POST", headers: { "content-type": "application/json" }, body });
    assert.equal(guest.json.promo.reason, "login_required");
    assert.equal(guest.json.productsTotal, price);
  });
});

test("checkout answers a refused code with its reason so the storefront can explain it", async () => {
  const { ids } = await buyer();
  await createCode({ minOrderAmount: "999999.00" });
  const token = jwt.sign({ sub: ids.customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
  const { payload } = await buyer();
  const { customerId: _customerId, ...body } = payload;
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
    assert.equal(response.status, 409, JSON.stringify(response.json));
    assert.equal(response.json.code, "PROMO_REJECTED");
    assert.equal(response.json.promo.reason, "below_min");
    assert.ok(response.json.promo.missingAmount > 0);
  });
});

test("two identical COD submissions with a single-use code return the same order instead of refusing the replay", async () => {
  const { payload } = await buyer({ items: [{ type: "product", variantId: (await getBaselineIds()).firstVariantId, qty: 1 }] });
  await createCode({ totalUsageLimit: 1 });
  const idempotencyKey = crypto.randomUUID();
  const results = await Promise.all([1, 2].map(() => createOrderFromCheckout(payload, { idempotencyKey })));
  assert.equal(results[0]!.id, results[1]!.id);
  assert.equal((await db.select().from(orders)).length, 1);
});

test("a free promo order with free delivery is held from dispatch until staff release it", async () => {
  const { fixtureShippingService, selectedDestination } = await import("../helpers/checkout-shipping.js");
  const { shippingWorkItems } = await import("@capella/database/drizzle/schema");
  const { payload } = await buyer();
  await createCode({ discountType: "fixed", discountValue: "100000.00" });
  const shippingService = fixtureShippingService(0);
  const withAddress = { ...payload, shippingAddress: selectedDestination };
  const quote = await shippingService.quoteCheckout(withAddress, await priceCheckout(withAddress));
  const created = await createOrderFromCheckout({ ...withAddress, shippingQuoteId: quote.quoteId }, { idempotencyKey: crypto.randomUUID(), shippingService });
  const [job] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, created.id));
  assert.deepEqual([job!.status, job!.lastError], ["failed", "PROMO_FREE_REVIEW"]);

  const actorId = await createTestAdminUser({ name: "Reviewer", email: "free-review@capella.test", passwordHash: "unused", role: "admin" });
  const { retryOrderDeliveryCreation } = await import("../../src/modules/shipping/shipping-action.repository.js");
  await retryOrderDeliveryCreation(created.id, actorId);
  const [released] = await db.select().from(shippingWorkItems).where(eq(shippingWorkItems.orderId, created.id));
  assert.equal(released!.status, "pending");
  const [flag] = await db.select().from(orderReviewFlags).where(and(eq(orderReviewFlags.orderId, created.id), eq(orderReviewFlags.flagType, "promo_free_review")));
  assert.equal(flag!.status, "resolved");
});

test("the price endpoint checks a first-order code against the checkout phone once the customer has typed it", async () => {
  const ids = await getBaselineIds();
  await createCode({ firstOrderOnly: true });
  await db.insert(orders).values({ orderCode: "PAST-PHONE", customerType: "guest", customerId: null, fullName: "Earlier", phone: "+201077778888",
    email: "earlier@capella.test", governorate: "Cairo", cityArea: "Nasr City", addressLine: "Street", buildingApartment: "1", notes: "",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "100.00" });
  const token = jwt.sign({ sub: ids.customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
  await withTestServer(app, async (request) => {
    const price = (extra: object) => request("/api/v1/checkout/price", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], promoCode: "save10", ...extra }) });
    assert.equal((await price({})).json.promo.status, "applied");
    const withPhone = await price({ phone: "01077778888" });
    assert.equal(withPhone.json.promo?.reason, "first_order", JSON.stringify(withPhone.json));
    assert.equal((await price({ phone: "not a phone" })).status, 400);
  });
});

test("every request that checks a typed code counts toward the same per-account guessing limit", async () => {
  const ids = await getBaselineIds();
  const token = jwt.sign({ sub: ids.customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
  await withTestServer(app, async (request) => {
    const headers = { "content-type": "application/json", authorization: `Bearer ${token}`, "x-forwarded-for": "198.51.100.77" };
    const items = [{ type: "product", variantId: ids.firstVariantId, qty: 1 }];
    // 20 guesses through the delivery quote (shipping is off here, so each answers 503 after the code is counted).
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request("/api/v1/checkout/shipping/quote", { method: "POST", headers, body: JSON.stringify({ items, paymentMethod: "cod",
        shippingAddress: { cityId: "c", zoneId: "z", districtId: "d" }, promoCode: `GUESS${attempt}` }) });
    }
    const price = await request("/api/v1/checkout/price", { method: "POST", headers, body: JSON.stringify({ items, promoCode: "ONEMORE" }) });
    assert.equal(price.status, 429);
  });
});

test("re-pricing the code the customer already typed does not count as another guess", async () => {
  const ids = await getBaselineIds();
  await createCode();
  const [other] = await db.insert(customers).values({ name: "Repricer", email: "repricer@capella.test", passwordHash: "unused" }).$returningId();
  const token = jwt.sign({ sub: other!.id, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });
  await withTestServer(app, async (request) => {
    const headers = { "content-type": "application/json", authorization: `Bearer ${token}`, "x-forwarded-for": "198.51.100.78" };
    for (let qty = 1; qty <= 30; qty += 1) {
      const priced = await request("/api/v1/checkout/price", { method: "POST", headers,
        body: JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: (qty % 3) + 1 }], promoCode: "save10" }) });
      assert.equal(priced.status, 200, `request ${qty}`);
    }
  });
});
