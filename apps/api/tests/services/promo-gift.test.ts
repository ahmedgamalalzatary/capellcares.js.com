import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { and, eq } from "drizzle-orm";

import { db } from "@capella/database/src/db";
import { checkoutReservations, checkoutSessions, offerItems, orderItems, orders, productVariants, promoCodes, promoRedemptions } from "@capella/database/drizzle/schema";
import { initiatePaymobCheckout } from "../../src/modules/checkout/paymob-checkout.service.js";
import { releaseExpiredCheckoutReservations } from "../../src/modules/checkout/checkout-reservation.repository.js";
import { createOrderFromCheckout, priceCheckout } from "../../src/modules/orders/orders.service.js";
import { expirePendingCodOrders, updateOrderPaymentStatusRepo } from "../../src/modules/orders/order.repository.js";
import { processPaymobTransaction } from "../../src/modules/payments/paymob/paymob-transaction.service.js";
import { getBaselineIds, resetApiTestDatabase } from "../helpers/database.js";

// Phase 6 (spec sections 3.2, 4.4): a code can add a free item, at 0, outside every rule, reserved and restocked like any line.
beforeEach(resetApiTestDatabase);

type Gift = { type: "product_variant" | "offer" | "collection"; id: number; qty: number };

async function code(gift: Gift, overrides: Partial<typeof promoCodes.$inferInsert> = {}) {
  const [row] = await db.insert(promoCodes).values({ code: "GIFT", codeNormalized: "GIFT", arName: "هدية", enName: "Gift", status: "active",
    startsAt: new Date(Date.now() - 60_000), discountType: null, discountValue: null, eligibilityScope: "all",
    giftItemType: gift.type, giftItemId: gift.id, giftQty: gift.qty, ...overrides }).$returningId();
  return row!.id;
}

async function checkout(qty = 1, paymentMethod: "cod" | "paymob" = "cod") {
  const ids = await getBaselineIds();
  return {
    ids,
    payload: {
      fullName: "Gift Buyer", phone: "01012345678", email: "gift@capella.test", governorate: "Cairo", cityArea: "Nasr City",
      addressLine: "Street 1", buildingApartment: "1", paymentMethod, customerId: ids.customerId, promoCode: "gift",
      items: [{ type: "product" as const, variantId: ids.firstVariantId, qty }]
    }
  };
}

const stockOf = async (variantId: number) => (await db.select().from(productVariants).where(eq(productVariants.id, variantId)))[0]!.stockQty;
const giftLines = (orderId: number) => db.select().from(orderItems).where(and(eq(orderItems.orderId, orderId), eq(orderItems.isPromoGift, true)));

test("the gift is added as a separate line at 0, with its normal price kept for reports, and the products total is unchanged", async () => {
  const { ids, payload } = await checkout();
  await code({ type: "product_variant", id: ids.secondVariantId, qty: 2 });
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
  assert.equal(priced.promo!.application!.giftValueCents, Math.round(gift.snapshotBaseUnitPrice * 200));
});

test("an offer or collection gift carries its components and reserves each of them", async () => {
  const { ids, payload } = await checkout();
  await code({ type: "offer", id: ids.offerId, qty: 1 });
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
  await code({ type: "product_variant", id: ids.firstVariantId, qty: 5 }, { minEligiblePieces: 2 });
  const priced = await priceCheckout(payload);
  assert.equal(priced.promo?.dto.status === "rejected" && priced.promo.dto.reason, "min_pieces");
});

test("an out-of-stock gift leaves the rest of the code working and says so; a gift-only code is refused", async () => {
  const { ids, payload } = await checkout();
  await db.update(productVariants).set({ stockQty: 1 }).where(eq(productVariants.id, ids.secondVariantId));
  await code({ type: "product_variant", id: ids.secondVariantId, qty: 2 }, { discountType: "percentage", discountValue: "10.00" });
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
  await code({ type: "product_variant", id: ids.firstVariantId, qty: 2 }, { discountType: "percentage", discountValue: "10.00" });
  const priced = await priceCheckout(payload);
  assert.ok(priced.promo?.dto.status === "applied" && priced.promo.dto.giftUnavailable);
});

test("a cash-on-delivery gift order takes the gift's stock, and staff deny or 96-hour expiry put it back", async () => {
  const { ids, payload } = await checkout();
  await code({ type: "product_variant", id: ids.secondVariantId, qty: 2 });
  const before = await stockOf(ids.secondVariantId);
  const first = await createOrderFromCheckout(payload, { idempotencyKey: crypto.randomUUID() });
  assert.equal((await giftLines(first.id)).length, 1);
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  await updateOrderPaymentStatusRepo(first.id, "denied");
  assert.equal(await stockOf(ids.secondVariantId), before);

  await db.update(promoRedemptions).set({ state: "released" });
  const second = await createOrderFromCheckout({ ...payload, email: "gift-two@capella.test" }, { idempotencyKey: crypto.randomUUID() });
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  await expirePendingCodOrders(new Date(Date.now() + 200 * 60 * 60 * 1000));
  assert.equal((await db.select().from(orders).where(eq(orders.id, second.id)))[0]!.paymentStatus, "denied");
  assert.equal(await stockOf(ids.secondVariantId), before);
  const [use] = await db.select().from(promoRedemptions).where(eq(promoRedemptions.orderId, first.id));
  assert.ok(use!.giftValueCents > 0);
});

test("an online gift order reserves the gift with the cart and the paid order carries the gift line", async () => {
  const { ids, payload } = await checkout(1, "paymob");
  await code({ type: "product_variant", id: ids.secondVariantId, qty: 2 });
  const before = await stockOf(ids.secondVariantId);
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  await initiatePaymobCheckout({ payload, idempotencyKey: crypto.randomUUID(), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_gift", orderId: 9960, clientSecret: "gift_secret", checkoutUrl: "https://checkout" }) });
  const [session] = await db.select().from(checkoutSessions);
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  assert.ok((await db.select().from(checkoutReservations)).some((row) => row.variantId === ids.secondVariantId && row.qty === 2));

  const result = await processPaymobTransaction({ id: 79960, order: { id: 9960 }, amount_cents: session!.amountCents, currency: "EGP", integration_id: 123,
    success: true, pending: false, is_live: false, is_auth: false, is_capture: false, is_refunded: false, is_voided: false,
    has_parent_transaction: false, is_standalone_payment: true, source_data: { type: "card" } });
  assert.equal(result.outcome, "succeeded");
  const [gift] = await giftLines(result.orderId!);
  assert.deepEqual([gift!.variantId, gift!.qty, Number(gift!.lineTotal)], [ids.secondVariantId, 2, 0]);
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
});

test("the gift makes the parcel size estimate bigger, and a discount does not make it smaller", async () => {
  const { ids, payload } = await checkout();
  const plain = await priceCheckout({ ...payload, promoCode: undefined });
  await code({ type: "product_variant", id: ids.secondVariantId, qty: 2 }, { discountType: "percentage", discountValue: "50.00" });
  const priced = await priceCheckout(payload);
  const giftValueCents = priced.promo!.application!.giftValueCents;
  assert.equal(plain.parcelValueCents, Math.round(plain.totalAmount * 100));
  assert.equal(priced.parcelValueCents, Math.round(plain.totalAmount * 100) + giftValueCents);
});

test("an online gift checkout that expires unpaid gives the gift's stock back", async () => {
  const { ids, payload } = await checkout(1, "paymob");
  await code({ type: "product_variant", id: ids.secondVariantId, qty: 2 });
  const before = await stockOf(ids.secondVariantId);
  const config = { mode: "test" as const, baseUrl: "https://accept.paymob.com", secretKey: "secret", publicKey: "public", hmacSecret: "hmac",
    apiKey: null, enabledMethods: [{ method: "card" as const, integrationId: 123 }], canInitiatePayments: true, intentionExpirationSeconds: 1800 as const };
  await initiatePaymobCheckout({ payload, idempotencyKey: crypto.randomUUID(), config,
    notificationUrl: "https://api.capellacares.com/api/v1/payments/paymob/webhook", redirectionUrl: "https://capellacares.com/checkout/payment-result",
    createIntention: async () => ({ intentionId: "pi_gift_exp", orderId: 9961, clientSecret: "gift_exp", checkoutUrl: "https://checkout" }) });
  assert.equal(await stockOf(ids.secondVariantId), before - 2);
  await releaseExpiredCheckoutReservations(new Date(Date.now() + 2 * 60 * 60 * 1000));
  assert.equal(await stockOf(ids.secondVariantId), before);
});
