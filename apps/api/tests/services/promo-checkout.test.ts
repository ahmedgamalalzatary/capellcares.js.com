import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

import { db } from "@capella/database/src/db";
import {
  customers,
  orderItems,
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
import { cancelCustomerOrderRepo, expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { PromoRejectedError } from "../../src/modules/promos/promo-checkout.js";
import { getAdminAuthHeaders } from "../helpers/admin-auth.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";
import { withTestServer } from "../helpers/request.js";

beforeEach(resetApiTestDatabase);

type CodeOverrides = Partial<typeof promoCodes.$inferInsert> & { include?: Array<{ type: "category" | "product" | "variant" | "offer" | "collection"; id: number }> };

async function createCode(overrides: CodeOverrides = {}) {
  const { include, ...columns } = overrides;
  const text = (columns.code ?? "SAVE10").toUpperCase();
  const [row] = await db.insert(promoCodes).values({
    arName: "خصم", enName: "Save", status: "active", startsAt: new Date(Date.now() - 60_000),
    discountType: "percentage", discountValue: "10.000", eligibilityScope: include ? "selected" : "all",
    ...columns, code: text, codeNormalized: text
  }).$returningId();
  if (include) await db.insert(promoCodeTargets).values(include.map((target) => ({ promoCodeId: row!.id, targetType: target.type, targetId: target.id, mode: "include" as const })));
  return row!.id;
}

/** KWD rounded to fils, the way every stored price is. */
const kwd = (value: number) => Math.round(value * 1000) / 1000;
const variantPrice = async (variantId: number) =>
  Number((await db.select({ price: productVariants.sellingPrice }).from(productVariants).where(eq(productVariants.id, variantId)))[0]!.price);
const stock = async (variantId: number) =>
  (await db.select({ stock: productVariants.stockQty }).from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stock;
const redemptions = (codeId: number) => db.select().from(promoRedemptions).where(eq(promoRedemptions.promoCodeId, codeId));
const customerToken = (customerId: number) => jwt.sign({ sub: customerId, role: "customer" }, process.env.JWT_ACCESS_SECRET ?? "dev-access-secret", { expiresIn: "15m" });

async function buyer(overrides: Record<string, unknown> = {}) {
  const ids = await getBaselineIds();
  return {
    ids,
    payload: {
      fullName: "Promo Buyer", phone: "55123456", email: "promo-buyer@capella.test", areaId: ids.areaId,
      addressLine: "Street 1", buildingApartment: "Building 2", paymentMethod: "cod" as const, customerId: ids.customerId,
      promoCode: "save10", items: [{ type: "product" as const, variantId: ids.firstVariantId, qty: 2 }],
      ...overrides
    }
  };
}

test("priceCheckout takes the code off eligible lines and reports it, leaving other lines at their price", async () => {
  const ids = await getBaselineIds();
  const { payload } = await buyer({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 2 }, { type: "product", variantId: ids.secondVariantId, qty: 1 }] });
  await createCode({ include: [{ type: "variant", id: ids.firstVariantId }] });
  const first = await variantPrice(ids.firstVariantId);
  const second = await variantPrice(ids.secondVariantId);

  const priced = await priceCheckout(payload);
  assert.equal(priced.promo?.dto.status, "applied");
  assert.equal(priced.items[0].lineTotal, kwd(first * 2 * 0.9));
  assert.equal(priced.items[0].promoDiscountAmount, kwd(first * 2 * 0.1));
  assert.equal(priced.items[1].lineTotal, second);
  assert.equal(Math.round(priced.totalAmount * 1000), Math.round((first * 2 * 0.9 + second) * 1000));
});

test("a guest's code is refused with a login prompt and the cart keeps its prices", async () => {
  const { ids, payload } = await buyer({ customerId: null });
  await createCode();
  const priced = await priceCheckout(payload);
  assert.deepEqual(priced.promo?.dto, { status: "rejected", code: "SAVE10", reason: "login_required" });
  assert.equal(priced.items[0].lineTotal, (await variantPrice(ids.firstVariantId)) * 2);
});

test("the code replaces a sale on the pieces it discounts and reports the new price for confirmation", async () => {
  const ids = await getBaselineIds();
  const { payload } = await buyer({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] });
  const [sale] = await db.insert(variantDiscounts).values({ variantId: ids.firstVariantId, type: "percentage", value: "30.000",
    startsAt: new Date(Date.now() - 86_400_000), endsAt: new Date(Date.now() + 86_400_000), status: "active" }).$returningId();
  await createCode({ discountValue: "10.000" });
  const original = await variantPrice(ids.firstVariantId);

  const priced = await priceCheckout(payload);
  assert.equal(priced.items[0].unitPrice, original);
  assert.equal(priced.items[0].lineTotal, kwd(original * 0.9));
  assert.equal(priced.items[0].promoReplacedDiscountId, sale!.id);
  const dto = priced.promo?.dto;
  assert.ok(dto && dto.status === "applied");
  assert.equal(dto.replacedSales.length, 1);
  assert.equal(dto.replacedSales[0]!.previousLineTotal, kwd(original * 0.7));
});

test("a COD order with a code stores the code, the paid line totals and one used redemption under the normalized phone", async () => {
  const { ids, payload } = await buyer();
  const codeId = await createCode();
  const price = await variantPrice(ids.firstVariantId);

  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  assert.equal(order!.promoCodeId, codeId);
  assert.equal(order!.promoCodeText, "SAVE10");
  assert.equal(order!.promoDiscountFils, Math.round(price * 2 * 100));
  assert.equal(order!.promoFreeReview, null);
  assert.equal(Number(order!.totalAmount), kwd(price * 2 * 0.9));
  const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, created.id));
  assert.equal(Number(item!.lineTotal), Number(order!.totalAmount));
  assert.equal(Number(item!.promoDiscountAmount), kwd(price * 2 * 0.1));
  const uses = await redemptions(codeId);
  assert.deepEqual(uses.map((use) => [use.state, use.orderId, use.customerId, use.phoneNormalized]), [["used", created.id, ids.customerId, "+96555123456"]]);
});

test("a single-use code taken by two checkouts at once is used exactly once; the other is told the limit was reached", async () => {
  const ids = await getBaselineIds();
  const { payload } = await buyer({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] });
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
  await db.insert(promoRedemptions).values({ promoCodeId: codeId, customerId: null, phoneNormalized: "+96555123456", state: "used" });
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

test("staff denying an order gives the code use back, so a single-use code works again", async () => {
  const { payload } = await buyer();
  const codeId = await createCode({ totalUsageLimit: 1 });
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await updateOrderPaymentStatusRepo(created.id, "denied");
  assert.deepEqual((await redemptions(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "denied"]]);
  assert.ok((await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() })).id);
});

test("a customer cancelling their own order gives the code use back", async () => {
  const { ids, payload } = await buyer();
  const codeId = await createCode();
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  assert.equal(await cancelCustomerOrderRepo(created.id, ids.customerId), "cancelled");
  assert.deepEqual((await redemptions(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "cancelled"]]);
});

test("an order expiring after 96 hours gives the code use back", async () => {
  const { payload } = await buyer();
  const codeId = await createCode();
  await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await expirePendingCodOrders(new Date(Date.now() + 97 * 60 * 60 * 1000));
  assert.deepEqual((await redemptions(codeId)).map((use) => [use.state, use.releaseReason]), [["released", "expired"]]);
});

test("accepting an order keeps its code use", async () => {
  const { payload } = await buyer();
  const codeId = await createCode();
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await updateOrderPaymentStatusRepo(created.id, "accepted");
  assert.deepEqual((await redemptions(codeId)).map((use) => use.state), ["used"]);
});

test("a code that makes the order free is accepted and waits for staff review, which staff then close", async () => {
  const { payload } = await buyer();
  await createCode({ discountType: "fixed", discountValue: "100000.000" });
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  assert.equal(Number(order!.totalAmount), 0);
  assert.equal(order!.paymentStatus, "accepted");
  assert.equal(order!.promoFreeReview, "open");

  await withTestServer(app, async (request) => {
    const headers = await getAdminAuthHeaders(request);
    const detail = await request(`/api/erp/orders/${created.id}`, { headers });
    assert.equal(detail.json.promoFreeReview, "open");
    assert.equal(detail.json.promoCodeText, "SAVE10");
    const resolved = await request(`/api/erp/orders/${created.id}/promo-review`, { method: "POST", headers });
    assert.equal(resolved.status, 200);
    assert.equal((await request(`/api/erp/orders/${created.id}/promo-review`, { method: "POST", headers })).status, 409);
  });
  const [after] = await db.select({ review: orders.promoFreeReview }).from(orders).where(eq(orders.id, created.id));
  assert.equal(after!.review, "resolved");
});

test("staff denying a free order closes its review and gives the use back", async () => {
  const { payload } = await buyer();
  const codeId = await createCode({ discountType: "fixed", discountValue: "100000.000" });
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await updateOrderPaymentStatusRepo(created.id, "denied");
  const [after] = await db.select({ review: orders.promoFreeReview }).from(orders).where(eq(orders.id, created.id));
  assert.equal(after!.review, "resolved");
  assert.deepEqual((await redemptions(codeId)).map((use) => use.state), ["released"]);
});

test("customers see the code on their order, but not the staff review or the rules snapshot", async () => {
  const { ids, payload } = await buyer();
  await createCode({ discountType: "fixed", discountValue: "100000.000" });
  const created = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  await withTestServer(app, async (request) => {
    const headers = { authorization: `Bearer ${customerToken(ids.customerId)}` };
    const detail = await request(`/api/v1/orders/${created.id}`, { headers });
    assert.equal(detail.status, 200, JSON.stringify(detail.json));
    const order = detail.json.order ?? detail.json;
    assert.equal(order.promoCodeText, "SAVE10");
    assert.equal("promoFreeReview" in order, false);
    assert.equal("promoSnapshot" in order, false);
  });
});

test("the storefront price endpoint returns every line, the products total and the code outcome", async () => {
  const { ids } = await buyer();
  await createCode();
  const price = await variantPrice(ids.firstVariantId);
  await withTestServer(app, async (request) => {
    const body = JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], promoCode: " save10 " });
    const signedIn = await request("/api/v1/checkout/price", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${customerToken(ids.customerId)}` }, body });
    assert.equal(signedIn.status, 200, JSON.stringify(signedIn.json));
    assert.equal(signedIn.json.promo.status, "applied");
    assert.equal(signedIn.json.productsTotal, kwd(price * 0.9));
    assert.deepEqual(signedIn.json.items[0], { index: 0, unitPrice: price, originalUnitPrice: price, lineTotal: kwd(price * 0.9), promoDiscount: kwd(price * 0.1) });

    const guest = await request("/api/v1/checkout/price", { method: "POST", headers: { "content-type": "application/json" }, body });
    assert.equal(guest.json.promo.reason, "login_required");
    assert.equal(guest.json.productsTotal, price);
  });
});

test("the checkout quote applies the code for the chosen area and reports a refused one without failing", async () => {
  const { ids } = await buyer();
  await createCode();
  const price = await variantPrice(ids.firstVariantId);
  await withTestServer(app, async (request) => {
    const headers = { "content-type": "application/json", authorization: `Bearer ${customerToken(ids.customerId)}` };
    const quote = (promoCode: string) => request("/api/v1/checkout/quote", { method: "POST", headers,
      body: JSON.stringify({ areaId: ids.areaId, items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], promoCode }) });
    const applied = await quote("save10");
    assert.equal(applied.status, 200, JSON.stringify(applied.json));
    assert.equal(applied.json.subtotal, kwd(price * 0.9));
    assert.equal(applied.json.promo.status, "applied");
    const unknown = await quote("nothing");
    assert.equal(unknown.status, 200);
    assert.equal(unknown.json.promo.reason, "not_found");
    assert.equal(unknown.json.subtotal, price);
  });
});

test("checkout answers a refused code with its reason so the storefront can explain it", async () => {
  const { ids, payload } = await buyer();
  await createCode({ minOrderAmount: "999999.000" });
  const { customerId: _customerId, ...body } = payload;
  await withTestServer(app, async (request) => {
    const response = await request("/api/v1/checkout", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${customerToken(ids.customerId)}`, "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) });
    assert.equal(response.status, 409, JSON.stringify(response.json));
    assert.equal(response.json.code, "PROMO_REJECTED");
    assert.equal(response.json.promo.reason, "below_min");
    assert.ok(response.json.promo.missingAmount > 0);
  });
});

test("two identical submissions with a single-use code return the same order instead of refusing the replay", async () => {
  const ids = await getBaselineIds();
  const { payload } = await buyer({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }] });
  await createCode({ totalUsageLimit: 1 });
  const idempotencyKey = crypto.randomUUID();
  const results = await Promise.all([1, 2].map(() => createOrderFromCheckout(payload, { idempotencyKey })));
  assert.equal(results[0]!.id, results[1]!.id);
  assert.equal((await db.select().from(orders)).length, 1);
});

test("the price endpoint checks a first-order code against the checkout phone once the customer has typed it", async () => {
  const ids = await getBaselineIds();
  await createCode({ firstOrderOnly: true });
  await db.insert(orders).values({ orderCode: "PAST-PHONE", customerType: "guest", customerId: null, fullName: "Earlier", phone: "+96566778899",
    email: "earlier@capella.test", governorate: "حولي", cityArea: "السالمية", addressLine: "Street", buildingApartment: "1", notes: "",
    paymentMethod: "cod", paymentStatus: "accepted", totalAmount: "10.000" });
  await withTestServer(app, async (request) => {
    const price = (extra: object) => request("/api/v1/checkout/price", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${customerToken(ids.customerId)}` },
      body: JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: 1 }], promoCode: "save10", ...extra }) });
    assert.equal((await price({})).json.promo.status, "applied");
    const withPhone = await price({ phone: "66778899" });
    assert.equal(withPhone.json.promo?.reason, "first_order", JSON.stringify(withPhone.json));
    assert.equal((await price({ phone: "not a phone" })).status, 400);
  });
});

test("every request that checks a typed code counts toward the same per-account guessing limit", async () => {
  const ids = await getBaselineIds();
  await withTestServer(app, async (request) => {
    const headers = { "content-type": "application/json", authorization: `Bearer ${customerToken(ids.customerId)}`, "x-forwarded-for": "198.51.100.77" };
    const items = [{ type: "product", variantId: ids.firstVariantId, qty: 1 }];
    // 20 guesses through the checkout quote, then one through the cart price.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request("/api/v1/checkout/quote", { method: "POST", headers, body: JSON.stringify({ areaId: ids.areaId, items, promoCode: `GUESS${attempt}` }) });
    }
    const price = await request("/api/v1/checkout/price", { method: "POST", headers, body: JSON.stringify({ items, promoCode: "ONEMORE" }) });
    assert.equal(price.status, 429);
  });
});

test("re-pricing the code the customer already typed does not count as another guess", async () => {
  const ids = await getBaselineIds();
  await createCode();
  const [other] = await db.insert(customers).values({ name: "Repricer", email: "repricer@capella.test", passwordHash: "unused" }).$returningId();
  await withTestServer(app, async (request) => {
    const headers = { "content-type": "application/json", authorization: `Bearer ${customerToken(other!.id)}`, "x-forwarded-for": "198.51.100.78" };
    for (let qty = 1; qty <= 30; qty += 1) {
      const priced = await request("/api/v1/checkout/price", { method: "POST", headers,
        body: JSON.stringify({ items: [{ type: "product", variantId: ids.firstVariantId, qty: (qty % 3) + 1 }], promoCode: "save10" }) });
      assert.equal(priced.status, 200, `request ${qty}`);
    }
  });
});
