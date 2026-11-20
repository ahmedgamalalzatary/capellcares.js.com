import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { deliveryAreas, offerItems, orderItems, orders, products, productVariants, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { createOrderFromCheckout, priceCheckout, quoteCheckout } from "../../src/modules/orders/orders.service.js";
import { cancelCustomerOrderRepo, expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

// Free gift (spec sections 3.2, 4.4) and free delivery (sections 3.2, 5.2, 8.6), for a cash-on-delivery store with area delivery fees.
beforeEach(resetApiTestDatabase);

type Gift = { type: "product_variant" | "offer" | "collection"; id: number; qty: number };

async function code(overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "TREAT", codeNormalized: "TREAT", arName: "هدية", enName: "Treat", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: null, discountValue: null, eligibilityScope: "all", ...overrides }).$returningId();
  return row!.id;
}
const giftCode = (gift: Gift, overrides: Partial<typeof promoCodes.$inferInsert> = {}) =>
  code({ giftItemType: gift.type, giftItemId: gift.id, giftQty: gift.qty, ...overrides });

/** A delivery area that charges a fee, next to the free baseline one. */
async function paidArea(fee: string) {
  const ids = await getBaselineIds();
  const [baseline] = await db.select({ governorateId: deliveryAreas.governorateId }).from(deliveryAreas).where(eq(deliveryAreas.id, ids.areaId));
  const [row] = await db.insert(deliveryAreas).values({ governorateId: baseline!.governorateId, arName: "حولي", enName: "Hawalli", fee }).$returningId();
  return row!.id;
}

async function checkout(qty = 1, areaId?: number) {
  const ids = await getBaselineIds();
  return {
    ids,
    payload: {
      fullName: "Treat Buyer", phone: "55123456", email: "treat@capella.test", areaId: areaId ?? ids.areaId,
      addressLine: "Street 1", buildingApartment: "1", paymentMethod: "cod" as const, customerId: ids.customerId, promoCode: "treat",
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty }]
    }
  };
}

const stockOf = async (variantId: number) => (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stockQty;
const giftLines = (orderId: number) => db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.isPromoGift, true)));

test("the gift is added as a separate line at 0, with its normal price kept for reports, and the products total is unchanged", async () => {
  const { ids, payload } = await checkout();
  await giftCode({ type: "product_variant", id: ids.secondVariantId, qty: 2 });
  const plain = await priceCheckout({ ...payload, promoCode: undefined });
  const priced = await priceCheckout(payload);
  assert.equal(priced.promo?.dto.status, "applied");
  const gift = priced.items.at(-1)!;
  assert.equal(priced.items.length, 2);
  assert.deepEqual([gift.isPromoGift, gift.variantId, gift.qty, gift.unitPrice, gift.lineTotal], [true, ids.secondVariantId, 2, 0, 0]);
  assert.ok(gift.snapshotBaseUnitPrice > 0);
  assert.equal(priced.totalAmount, plain.totalAmount);
  assert.deepEqual(priced.reservations.find((row) => row.variantId === ids.secondVariantId), { variantId: ids.secondVariantId, qty: 2 });
  const dto = priced.promo!.dto;
  assert.ok(dto.status === "applied" && dto.gift && dto.gift.qty === 2 && dto.gift.value === gift.snapshotBaseUnitPrice * 2);
  assert.equal(priced.promo!.application!.giftValueFils, Math.round(gift.snapshotBaseUnitPrice * 2000));
});

test("an offer gift carries its components and takes stock for each of them", async () => {
  const { ids, payload } = await checkout();
  await giftCode({ type: "offer", id: ids.offerId, qty: 1 });
  const components = await db.select().from(offerItems).where(eq(offerItems.offerId, ids.offerId));
  const priced = await priceCheckout(payload);
  const gift = priced.items.at(-1)!;
  assert.equal(gift.itemType, "offer");
  assert.equal(gift.isPromoGift, true);
  assert.equal(gift.snapshotComponents.length, components.length);
  for (const component of components) {
    assert.ok(priced.reservations.some((row) => row.variantId === component.variantId && row.qty >= component.qty));
  }
});

test("the gift never counts toward the code's rules", async () => {
  const { ids, payload } = await checkout(1);
  // Two eligible pieces needed: the one bought counts, the free one does not.
  await giftCode({ type: "product_variant", id: ids.firstVariantId, qty: 5 }, { minEligiblePieces: 2 });
  const priced = await priceCheckout(payload);
  assert.equal(priced.promo?.dto.status === "rejected" && priced.promo.dto.reason, "min_pieces");
});

test("an out-of-stock gift leaves the rest of the code working and says so; a gift-only code is refused", async () => {
  const { ids, payload } = await checkout();
  await db.update(productVariants).set({ stockQty: 1 }).where(eq(productVariants.id, ids.secondVariantId));
  await giftCode({ type: "product_variant", id: ids.secondVariantId, qty: 2 }, { discountType: "percentage", discountValue: "10.000" });
  const priced = await priceCheckout(payload);
  assert.equal(priced.promo?.dto.status, "applied");
  assert.ok(priced.promo?.dto.status === "applied" && priced.promo.dto.giftUnavailable && priced.promo.dto.gift === null);
  assert.equal(priced.items.length, 1);

  await db.update(promoCodes).set({ discountType: null, discountValue: null });
  const giftOnly = await priceCheckout(payload);
  assert.equal(giftOnly.promo?.dto.status === "rejected" && giftOnly.promo.dto.reason, "gift_unavailable");
});

test("stock the cart itself needs is not offered again as the gift", async () => {
  const { ids, payload } = await checkout(9);
  // 10 in stock, 9 in the cart: a gift of 2 more of the same item does not fit.
  await giftCode({ type: "product_variant", id: ids.firstVariantId, qty: 2 }, { discountType: "percentage", discountValue: "10.000" });
  const priced = await priceCheckout(payload);
  assert.ok(priced.promo?.dto.status === "applied" && priced.promo.dto.giftUnavailable);
});

test("a gift order takes the gift's stock, and staff deny, customer cancel and 96-hour expiry each put it back", async () => {
  const { ids, payload } = await checkout();
  await giftCode({ type: "product_variant", id: ids.secondVariantId, qty: 2 });
  const before = await stockOf(ids.secondVariantId);

  const denied = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  assert.equal((await giftLines(denied.id)).length, 1);
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  await updateOrderPaymentStatusRepo(denied.id, "denied");
  assert.equal(await stockOf(ids.secondVariantId), before);

  const cancelled = await createOrderFromCheckout({ ...payload, email: "treat-cancel@capella.test" }, { idempotencyKey: crypto.randomUUID() });
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  assert.equal(await cancelCustomerOrderRepo(cancelled.id, ids.customerId), "cancelled");
  assert.equal(await stockOf(ids.secondVariantId), before);

  const expired = await createOrderFromCheckout({ ...payload, email: "treat-expire@capella.test" }, { idempotencyKey: crypto.randomUUID() });
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  await expirePendingCodOrders(new Date(Date.now() + 200 * 60 * 60 * 1000));
  assert.equal((await db.select().from(orders).where(eq(orders.id, expired.id)))[0]!.paymentStatus, "denied");
  assert.equal(await stockOf(ids.secondVariantId), before);

  const [use] = await db.select().from(promoRedemptions).where(eq(promoRedemptions.orderId, denied.id));
  assert.ok(use!.giftValueFils > 0);
});

test("a gift with its own delivery fee adds nothing to delivery", async () => {
  const { ids, payload } = await checkout();
  const [gifted] = await db.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, ids.secondVariantId));
  await db.update(products).set({ deliveryFee: "3.500" }).where(eq(products.id, gifted!.productId));
  await giftCode({ type: "product_variant", id: ids.secondVariantId, qty: 1 });
  const plain = await quoteCheckout({ ...payload, promoCode: undefined });
  const withGift = await quoteCheckout(payload);
  assert.equal(withGift.deliveryFee, plain.deliveryFee);
});

test("free delivery charges the customer nothing and records the area fee the store absorbs", async () => {
  const areaId = await paidArea("1.250");
  const { payload } = await checkout(1, areaId);
  await code({ freeShipping: true });
  const plain = await quoteCheckout({ ...payload, promoCode: undefined });
  assert.equal(plain.deliveryFee, 1.25);
  const quote = await quoteCheckout(payload);
  assert.equal(quote.deliveryFee, 0);
  assert.equal(quote.deliveryFeeWaived, 1.25);
  assert.equal(quote.total, quote.subtotal);

  const created = await createOrderFromCheckout({ ...payload, expectedAmountFils: Math.round(quote.total * 1000) }, { idempotencyKey: crypto.randomUUID() });
  const [order] = await db.select().from(orders).where(eq(orders.id, created.id));
  assert.equal(Number(order!.deliveryFee), 0);
  assert.equal(order!.promoShippingWaivedFils, 1250);
  assert.equal(Number(order!.totalAmount), quote.subtotal);
  const [use] = await db.select().from(promoRedemptions).where(eq(promoRedemptions.orderId, created.id));
  assert.equal(use!.shippingWaivedFils, 1250);
});

test("free delivery also waives a product's own delivery fee", async () => {
  const areaId = await paidArea("1.000");
  const { ids, payload } = await checkout(1, areaId);
  const [bought] = await db.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, ids.firstVariantId));
  await db.update(products).set({ deliveryFee: "5.000" }).where(eq(products.id, bought!.productId));
  await code({ freeShipping: true });
  const plain = await quoteCheckout({ ...payload, promoCode: undefined });
  const quote = await quoteCheckout(payload);
  assert.equal(plain.deliveryFee, 5);
  assert.equal(quote.deliveryFee, 0);
  assert.equal(quote.deliveryFeeWaived, 5);
});

test("a free-delivery-only code applies even where delivery costs nothing, and records nothing absorbed", async () => {
  const { payload } = await checkout();
  await code({ freeShipping: true });
  const quote = await quoteCheckout(payload);
  assert.equal(quote.priced.promo?.dto.status, "applied");
  assert.equal(quote.deliveryFee, 0);
  assert.equal(quote.deliveryFeeWaived, 0);
});
