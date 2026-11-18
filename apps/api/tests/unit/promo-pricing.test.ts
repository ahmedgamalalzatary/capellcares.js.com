import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  applyPromoPricing,
  validatePromoAccess,
  type PromoAccessContext,
  type PromoLine,
  type PromoRules
} from "../../src/modules/promos/promo-pricing.js";

const rules = (overrides: Partial<PromoRules> = {}): PromoRules => ({
  discountType: "percentage",
  discountValue: 10,
  maxDiscountAmount: null,
  freeShipping: false,
  hasGift: false,
  eligibility: { scope: "all", include: [], exclude: [] },
  minOrderAmount: null,
  maxOrderAmount: null,
  minEligiblePieces: null,
  maxDiscountedPieces: null,
  ...overrides
});

let nextKey = 0;
const variantLine = (overrides: Partial<PromoLine> & { original: number; qty?: number; sale?: number }): PromoLine => {
  const { original, sale, qty = 1, ...rest } = overrides;
  const unitPrice = sale ?? original;
  return {
    key: `line-${nextKey++}`,
    itemType: "product_variant",
    variantId: 100 + nextKey,
    productId: 10,
    categoryIds: [1],
    offerId: null,
    collectionId: null,
    qty,
    originalUnitPrice: original,
    unitPrice,
    lineTotal: unitPrice * qty,
    saleDiscountId: sale === undefined ? null : 900,
    ...rest
  };
};

const pricing = (code: PromoRules, lines: PromoLine[], context = { shippingAvailable: true, giftAvailable: false }) =>
  applyPromoPricing(code, lines, context);

const success = (result: ReturnType<typeof applyPromoPricing>) => {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<ReturnType<typeof applyPromoPricing>, { ok: true }>;
};

describe("promo benefits", () => {
  test("percentage takes the share off every eligible piece", () => {
    const result = success(pricing(rules({ discountValue: 20 }), [variantLine({ original: 100, qty: 2 }), variantLine({ original: 50 })]));
    assert.equal(result.discountCents, 5000);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [160, 40]);
    assert.deepEqual(result.lines.map((line) => line.promoDiscount), [40, 10]);
  });

  test("a percentage cap scales every piece's discount down to the cap", () => {
    const result = success(pricing(rules({ discountValue: 50, maxDiscountAmount: 30 }), [variantLine({ original: 100 }), variantLine({ original: 20 })]));
    // Uncapped 50 + 10 = 60; capped to 30 = 25 + 5.
    assert.equal(result.discountCents, 3000);
    assert.deepEqual(result.lines.map((line) => line.promoDiscount), [25, 5]);
  });

  test("a fixed amount comes off the eligible total once, spread by original price", () => {
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 30 }), [variantLine({ original: 200 }), variantLine({ original: 100 })]));
    assert.equal(result.discountCents, 3000);
    assert.deepEqual(result.lines.map((line) => line.promoDiscount), [20, 10]);
  });

  test("a fixed amount larger than the eligible total stops at the total, so items can reach 0", () => {
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 500 }), [variantLine({ original: 120 }), variantLine({ original: 80 })]));
    assert.equal(result.discountCents, 20000);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [0, 0]);
  });

  test("uneven splits round to piastres and still add up to the exact discount, leftovers on the most expensive line", () => {
    const lines = [variantLine({ original: 10 }), variantLine({ original: 10 }), variantLine({ original: 10.01 })];
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 10 }), lines));
    const cents = result.lines.map((line) => Math.round(line.promoDiscount * 100));
    assert.equal(cents.reduce((sum, value) => sum + value, 0), 1000);
    assert.deepEqual(cents, [333, 333, 334]);
  });

  test("free shipping alone is a valid code when delivery is available", () => {
    const result = success(pricing(rules({ discountType: null, discountValue: null, freeShipping: true }), [variantLine({ original: 100 })]));
    assert.equal(result.freeShipping, true);
    assert.equal(result.discountCents, 0);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [100]);
  });
});

describe("sale prices", () => {
  test("the code replaces the sale on the pieces it discounts and is calculated from the original price", () => {
    const result = success(pricing(rules({ discountValue: 20 }), [variantLine({ original: 200, sale: 150 })]));
    // 20% of the original 200 = 160: dearer than the 150 sale price, which the customer confirms before applying.
    assert.equal(result.lines[0]!.lineTotal, 160);
    assert.equal(result.lines[0]!.unitPrice, 200);
    assert.equal(result.lines[0]!.saleGivenUp, 50);
    assert.equal(result.lines[0]!.replacedSaleDiscountId, 900);
    assert.deepEqual(result.replacedSales, [{ key: result.lines[0]!.key, previousLineTotal: 150, lineTotal: 160 }]);
  });

  test("items the code does not cover keep their sale price", () => {
    const excluded = variantLine({ original: 200, sale: 150, productId: 77 });
    const code = rules({ eligibility: { scope: "all", include: [], exclude: [{ type: "product", id: 77 }] } });
    const result = success(pricing(code, [excluded, variantLine({ original: 100 })]));
    assert.equal(result.lines[0]!.lineTotal, 150);
    assert.equal(result.lines[0]!.replacedSaleDiscountId, null);
    assert.deepEqual(result.replacedSales, []);
  });
});

describe("max discounted pieces", () => {
  test("counts each piece separately and discounts the pieces with the biggest saving against the original price", () => {
    // 6 eligible pieces, max 5: the cheapest single piece (60) is left at its current price.
    const lines = [variantLine({ original: 100, qty: 3 }), variantLine({ original: 200, sale: 150, qty: 2 }), variantLine({ original: 60 })];
    const result = success(pricing(rules({ discountValue: 10, maxDiscountedPieces: 5 }), lines));
    assert.deepEqual(result.lines.map((line) => line.discountedPieces), [3, 2, 0]);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [270, 360, 60]);
  });

  test("a line with only some pieces discounted stays one line: unit price is the original, line total what is paid", () => {
    const result = success(pricing(rules({ discountValue: 10, maxDiscountedPieces: 2 }), [variantLine({ original: 100, sale: 80, qty: 3 })]));
    const [line] = result.lines;
    assert.equal(line!.discountedPieces, 2);
    assert.equal(line!.unitPrice, 100);
    // Two pieces at the code price (90 each) and one still on sale (80).
    assert.equal(line!.lineTotal, 260);
    assert.equal(line!.promoDiscount, 20);
    assert.equal(line!.saleGivenUp, 40);
  });
});

describe("percentage precision", () => {
  test("a percentage is applied from its stored hundredths, so a half-piastre rounds up", () => {
    // 1.14% of EGP 25 is exactly 28.5 piastres; plain floating-point multiplication lands just under it.
    const result = success(pricing(rules({ discountValue: 1.14 }), [variantLine({ original: 25 })]));
    assert.equal(result.discountCents, 29);
  });
});

describe("large carts", () => {
  test("works per line, not per piece, so a huge quantity costs no more than a small one", () => {
    // 5 billion pieces would not even fit in an array if every piece were its own object.
    const started = Date.now();
    const result = success(pricing(rules({ discountValue: 10, maxDiscountedPieces: 3 }), [variantLine({ original: 100, qty: 5_000_000_000 }), variantLine({ original: 200 })]));
    assert.ok(Date.now() - started < 1000);
    assert.deepEqual(result.lines.map((line) => line.discountedPieces), [2, 1]);
    assert.equal(result.discountCents, 4000);
  });
});

describe("rounding", () => {
  test("a line that receives none of the discount keeps its sale", () => {
    // EGP 0.01 goes whole to the dearer line; the cheaper line must not lose its sale for nothing.
    const cheap = variantLine({ original: 10, sale: 5 });
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 0.01 }), [variantLine({ original: 100, sale: 50 }), cheap]));
    const [, kept] = result.lines;
    assert.equal(kept!.lineTotal, 5);
    assert.equal(kept!.unitPrice, 5);
    assert.equal(kept!.discountedPieces, 0);
    assert.equal(kept!.saleGivenUp, 0);
    assert.equal(kept!.replacedSaleDiscountId, null);
    assert.deepEqual(result.replacedSales.map((sale) => sale.key), [result.lines[0]!.key]);
    assert.equal(result.saleGivenUpCents, 5000);
    assert.equal(result.lines.reduce((sum, line) => sum + Math.round(line.promoDiscount * 100), 0), result.discountCents);
  });
});

describe("eligibility", () => {
  test("selected categories cover products in them (including sub-categories passed as lineage), not other products", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "category", id: 5 }], exclude: [] } });
    const result = success(pricing(code, [variantLine({ original: 100, categoryIds: [1, 5, 9] }), variantLine({ original: 100, categoryIds: [2] })]));
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [90, 100]);
  });

  test("a product inside an offer is not eligible through that offer", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "product", id: 10 }], exclude: [] } });
    const offerLine = variantLine({ original: 300, itemType: "offer", offerId: 4, variantId: null, productId: null, categoryIds: [] });
    const result = pricing(code, [offerLine]);
    assert.deepEqual(result, { ok: false, reason: "no_effect" });
  });

  test("selected offers, collections and variants match their own lines", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "offer", id: 4 }, { type: "collection", id: 6 }, { type: "variant", id: 555 }], exclude: [] } });
    const lines = [
      variantLine({ original: 100, itemType: "offer", offerId: 4, variantId: null, productId: null, categoryIds: [] }),
      variantLine({ original: 100, itemType: "collection", collectionId: 6, variantId: null, productId: null, categoryIds: [] }),
      variantLine({ original: 100, variantId: 555 }),
      variantLine({ original: 100, variantId: 556 })
    ];
    assert.deepEqual(success(pricing(code, lines)).lines.map((line) => line.lineTotal), [90, 90, 90, 100]);
  });

  test("an exclusion wins over an inclusion", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "category", id: 1 }], exclude: [{ type: "variant", id: 700 }] } });
    const result = success(pricing(code, [variantLine({ original: 100, variantId: 700 }), variantLine({ original: 100 })]));
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [100, 90]);
  });
});

describe("rules that reject the code", () => {
  test("the order amount range uses the cart as shown: sale prices, before the code, without shipping", () => {
    const lines = [variantLine({ original: 200, sale: 150 })];
    assert.deepEqual(pricing(rules({ minOrderAmount: 160 }), lines), { ok: false, reason: "below_min", missingAmount: 10 });
    assert.equal(pricing(rules({ minOrderAmount: 150 }), lines).ok, true);
    assert.deepEqual(pricing(rules({ maxOrderAmount: 149.99 }), lines), { ok: false, reason: "above_max", maxAmount: 149.99 });
  });

  test("min eligible pieces counts each piece of the eligible lines only", () => {
    const code = rules({ minEligiblePieces: 3, eligibility: { scope: "selected", include: [{ type: "product", id: 10 }], exclude: [] } });
    const lines = [variantLine({ original: 50, qty: 2 }), variantLine({ original: 50, qty: 5, productId: 11 })];
    assert.deepEqual(pricing(code, lines), { ok: false, reason: "min_pieces", missingPieces: 1 });
    assert.equal(pricing(code, [variantLine({ original: 50, qty: 3 })]).ok, true);
  });

  test("a code with nothing to discount and no other benefit has no effect", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "product", id: 999 }], exclude: [] } });
    assert.deepEqual(pricing(code, [variantLine({ original: 100 })]), { ok: false, reason: "no_effect" });
  });

  test("a code limited to chosen items gives no free delivery or gift to a cart without any of them", () => {
    const code = rules({ freeShipping: true, hasGift: true, eligibility: { scope: "selected", include: [{ type: "product", id: 999 }], exclude: [] } });
    assert.deepEqual(pricing(code, [variantLine({ original: 100 })], { shippingAvailable: true, giftAvailable: true }), { ok: false, reason: "no_effect" });
  });

  test("a free-shipping-only code is refused while delivery is unavailable, and other benefits still apply", () => {
    const freeOnly = rules({ discountType: null, discountValue: null, freeShipping: true });
    const offline = { shippingAvailable: false, giftAvailable: false };
    assert.deepEqual(pricing(freeOnly, [variantLine({ original: 100 })], offline), { ok: false, reason: "free_shipping_unavailable" });
    const both = success(pricing(rules({ freeShipping: true }), [variantLine({ original: 100 })], offline));
    assert.equal(both.freeShipping, false);
    assert.equal(both.discountCents, 1000);
  });

  test("a gift-only code works while the gift is available and has no effect when it is not", () => {
    const giftOnly = rules({ discountType: null, discountValue: null, hasGift: true });
    assert.equal(pricing(giftOnly, [variantLine({ original: 100 })], { shippingAvailable: true, giftAvailable: true }).ok, true);
    assert.deepEqual(pricing(giftOnly, [variantLine({ original: 100 })], { shippingAvailable: true, giftAvailable: false }), { ok: false, reason: "gift_unavailable" });
  });
});

describe("validatePromoAccess", () => {
  const now = new Date("2026-11-18T12:00:00Z");
  const code = {
    status: "active" as const,
    startsAt: new Date("2026-11-01T00:00:00Z"),
    endsAt: new Date("2026-12-01T00:00:00Z"),
    isPrivate: false,
    firstOrderOnly: false,
    totalUsageLimit: null as number | null,
    perCustomerLimit: null as number | null
  };
  const context = (overrides: Partial<PromoAccessContext> = {}): PromoAccessContext => ({
    customerId: 7, now, onPrivateList: false, hasPreviousOrder: false, usedTotal: 0, usedByCustomer: 0, ...overrides
  });

  test("checks login, status, schedule, private list, first order and limits in that order", () => {
    assert.equal(validatePromoAccess(null, context()), "not_found");
    assert.equal(validatePromoAccess({ ...code, status: "paused" }, context({ customerId: null })), "login_required");
    assert.equal(validatePromoAccess({ ...code, status: "paused" }, context()), "inactive");
    assert.equal(validatePromoAccess({ ...code, status: "stopped" }, context()), "inactive");
    assert.equal(validatePromoAccess(code, context({ now: new Date("2026-10-31T23:59:59Z") })), "inactive");
    assert.equal(validatePromoAccess(code, context({ now: new Date("2026-12-01T00:00:00Z") })), "inactive");
    assert.equal(validatePromoAccess({ ...code, isPrivate: true, firstOrderOnly: true }, context({ hasPreviousOrder: true })), "private");
    assert.equal(validatePromoAccess({ ...code, firstOrderOnly: true, totalUsageLimit: 1 }, context({ hasPreviousOrder: true, usedTotal: 1 })), "first_order");
    assert.equal(validatePromoAccess({ ...code, totalUsageLimit: 3, perCustomerLimit: 1 }, context({ usedTotal: 3, usedByCustomer: 1 })), "usage_limit");
    assert.equal(validatePromoAccess({ ...code, perCustomerLimit: 2 }, context({ usedByCustomer: 2 })), "customer_limit");
  });

  test("accepts a usable code, including one with no end date and a private code for a listed customer", () => {
    assert.equal(validatePromoAccess(code, context()), null);
    assert.equal(validatePromoAccess({ ...code, endsAt: null }, context({ now: new Date("2030-01-01T00:00:00Z") })), null);
    assert.equal(validatePromoAccess({ ...code, isPrivate: true }, context({ onPrivateList: true })), null);
    assert.equal(validatePromoAccess({ ...code, totalUsageLimit: 3, perCustomerLimit: 2 }, context({ usedTotal: 2, usedByCustomer: 1 })), null);
  });
});
