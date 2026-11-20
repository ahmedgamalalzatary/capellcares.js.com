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

const pricing = (code: PromoRules, lines: PromoLine[], context = { giftAvailable: false }) =>
  applyPromoPricing(code, lines, context);

const success = (result: ReturnType<typeof applyPromoPricing>) => {
  assert.equal(result.ok, true, JSON.stringify(result));
  return result as Extract<ReturnType<typeof applyPromoPricing>, { ok: true }>;
};

describe("promo benefits", () => {
  test("percentage takes the share off every eligible piece", () => {
    const result = success(pricing(rules({ discountValue: 20 }), [variantLine({ original: 10, qty: 2 }), variantLine({ original: 5 })]));
    assert.equal(result.discountFils, 5000);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [16, 4]);
    assert.deepEqual(result.lines.map((line) => line.promoDiscount), [4, 1]);
  });

  test("a percentage cap scales every piece's discount down to the cap", () => {
    const result = success(pricing(rules({ discountValue: 50, maxDiscountAmount: 3 }), [variantLine({ original: 10 }), variantLine({ original: 2 })]));
    // Uncapped 5 + 1 = 6; capped to 3 = 2.5 + 0.5.
    assert.equal(result.discountFils, 3000);
    assert.deepEqual(result.lines.map((line) => line.promoDiscount), [2.5, 0.5]);
  });

  test("a fixed amount comes off the eligible total once, spread by original price", () => {
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 3 }), [variantLine({ original: 20 }), variantLine({ original: 10 })]));
    assert.equal(result.discountFils, 3000);
    assert.deepEqual(result.lines.map((line) => line.promoDiscount), [2, 1]);
  });

  test("a fixed amount larger than the eligible total stops at the total, so items can reach 0", () => {
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 50 }), [variantLine({ original: 12 }), variantLine({ original: 8 })]));
    assert.equal(result.discountFils, 20000);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [0, 0]);
  });

  test("uneven splits round to fils and still add up to the exact discount, leftovers on the most expensive line", () => {
    const lines = [variantLine({ original: 10 }), variantLine({ original: 10 }), variantLine({ original: 10.001 })];
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 1 }), lines));
    const fils = result.lines.map((line) => Math.round(line.promoDiscount * 1000));
    assert.equal(fils.reduce((sum, value) => sum + value, 0), 1000);
    assert.deepEqual(fils, [333, 333, 334]);
  });

  test("free delivery alone is a valid code, since every order here pays for delivery", () => {
    const result = success(pricing(rules({ discountType: null, discountValue: null, freeShipping: true }), [variantLine({ original: 10 })]));
    assert.equal(result.freeShipping, true);
    assert.equal(result.discountFils, 0);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [10]);
  });
});

describe("sale prices", () => {
  test("the code replaces the sale on the pieces it discounts and is calculated from the original price", () => {
    const result = success(pricing(rules({ discountValue: 20 }), [variantLine({ original: 20, sale: 15 })]));
    // 20% of the original 20 = 16: dearer than the 15 sale price, which the customer confirms before applying.
    assert.equal(result.lines[0]!.lineTotal, 16);
    assert.equal(result.lines[0]!.unitPrice, 20);
    assert.equal(result.lines[0]!.saleGivenUp, 5);
    assert.equal(result.lines[0]!.replacedSaleDiscountId, 900);
    assert.deepEqual(result.replacedSales, [{ key: result.lines[0]!.key, previousLineTotal: 15, lineTotal: 16 }]);
  });

  test("items the code does not cover keep their sale price", () => {
    const excluded = variantLine({ original: 20, sale: 15, productId: 77 });
    const code = rules({ eligibility: { scope: "all", include: [], exclude: [{ type: "product", id: 77 }] } });
    const result = success(pricing(code, [excluded, variantLine({ original: 10 })]));
    assert.equal(result.lines[0]!.lineTotal, 15);
    assert.equal(result.lines[0]!.replacedSaleDiscountId, null);
    assert.deepEqual(result.replacedSales, []);
  });
});

describe("max discounted pieces", () => {
  test("counts each piece separately and discounts the pieces with the biggest saving against the original price", () => {
    // 6 eligible pieces, max 5: the cheapest single piece (6) is left at its current price.
    const lines = [variantLine({ original: 10, qty: 3 }), variantLine({ original: 20, sale: 15, qty: 2 }), variantLine({ original: 6 })];
    const result = success(pricing(rules({ discountValue: 10, maxDiscountedPieces: 5 }), lines));
    assert.deepEqual(result.lines.map((line) => line.discountedPieces), [3, 2, 0]);
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [27, 36, 6]);
  });

  test("a line with only some pieces discounted stays one line: unit price is the original, line total what is paid", () => {
    const result = success(pricing(rules({ discountValue: 10, maxDiscountedPieces: 2 }), [variantLine({ original: 10, sale: 8, qty: 3 })]));
    const [line] = result.lines;
    assert.equal(line!.discountedPieces, 2);
    assert.equal(line!.unitPrice, 10);
    // Two pieces at the code price (9 each) and one still on sale (8).
    assert.equal(line!.lineTotal, 26);
    assert.equal(line!.promoDiscount, 2);
    assert.equal(line!.saleGivenUp, 4);
  });
});

describe("percentage precision", () => {
  test("a percentage is applied from its stored hundredths, so a half-fils rounds up", () => {
    // 1.14% of KWD 2.5 is exactly 28.5 fils; plain floating-point multiplication lands just under it.
    const result = success(pricing(rules({ discountValue: 1.14 }), [variantLine({ original: 2.5 })]));
    assert.equal(result.discountFils, 29);
  });
});

describe("large carts", () => {
  test("works per line, not per piece, so a huge quantity costs no more than a small one", () => {
    // 5 billion pieces would not even fit in an array if every piece were its own object.
    const started = Date.now();
    const result = success(pricing(rules({ discountValue: 10, maxDiscountedPieces: 3 }), [variantLine({ original: 10, qty: 5_000_000_000 }), variantLine({ original: 20 })]));
    assert.ok(Date.now() - started < 1000);
    assert.deepEqual(result.lines.map((line) => line.discountedPieces), [2, 1]);
    assert.equal(result.discountFils, 4000);
  });
});

describe("rounding", () => {
  test("a line that receives none of the discount keeps its sale", () => {
    // KWD 0.001 goes whole to the dearer line; the cheaper line must not lose its sale for nothing.
    const cheap = variantLine({ original: 1, sale: 0.5 });
    const result = success(pricing(rules({ discountType: "fixed", discountValue: 0.001 }), [variantLine({ original: 10, sale: 5 }), cheap]));
    const [, kept] = result.lines;
    assert.equal(kept!.lineTotal, 0.5);
    assert.equal(kept!.unitPrice, 0.5);
    assert.equal(kept!.discountedPieces, 0);
    assert.equal(kept!.saleGivenUp, 0);
    assert.equal(kept!.replacedSaleDiscountId, null);
    assert.deepEqual(result.replacedSales.map((sale) => sale.key), [result.lines[0]!.key]);
    assert.equal(result.saleGivenUpFils, 5000);
    assert.equal(result.lines.reduce((sum, line) => sum + Math.round(line.promoDiscount * 1000), 0), result.discountFils);
  });
});

describe("eligibility", () => {
  test("selected categories cover products in them (including sub-categories passed as lineage), not other products", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "category", id: 5 }], exclude: [] } });
    const result = success(pricing(code, [variantLine({ original: 10, categoryIds: [1, 5, 9] }), variantLine({ original: 10, categoryIds: [2] })]));
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [9, 10]);
  });

  test("a product inside an offer is not eligible through that offer", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "product", id: 10 }], exclude: [] } });
    const offerLine = variantLine({ original: 30, itemType: "offer", offerId: 4, variantId: null, productId: null, categoryIds: [] });
    const result = pricing(code, [offerLine]);
    assert.deepEqual(result, { ok: false, reason: "no_effect" });
  });

  test("selected offers, collections and variants match their own lines", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "offer", id: 4 }, { type: "collection", id: 6 }, { type: "variant", id: 555 }], exclude: [] } });
    const lines = [
      variantLine({ original: 10, itemType: "offer", offerId: 4, variantId: null, productId: null, categoryIds: [] }),
      variantLine({ original: 10, itemType: "collection", collectionId: 6, variantId: null, productId: null, categoryIds: [] }),
      variantLine({ original: 10, variantId: 555 }),
      variantLine({ original: 10, variantId: 556 })
    ];
    assert.deepEqual(success(pricing(code, lines)).lines.map((line) => line.lineTotal), [9, 9, 9, 10]);
  });

  test("an exclusion wins over an inclusion", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "category", id: 1 }], exclude: [{ type: "variant", id: 700 }] } });
    const result = success(pricing(code, [variantLine({ original: 10, variantId: 700 }), variantLine({ original: 10 })]));
    assert.deepEqual(result.lines.map((line) => line.lineTotal), [10, 9]);
  });
});

describe("rules that reject the code", () => {
  test("the order amount range uses the cart as shown: sale prices, before the code, without delivery", () => {
    const lines = [variantLine({ original: 20, sale: 15 })];
    assert.deepEqual(pricing(rules({ minOrderAmount: 16 }), lines), { ok: false, reason: "below_min", missingAmount: 1 });
    assert.equal(pricing(rules({ minOrderAmount: 15 }), lines).ok, true);
    assert.deepEqual(pricing(rules({ maxOrderAmount: 14.999 }), lines), { ok: false, reason: "above_max", maxAmount: 14.999 });
  });

  test("min eligible pieces counts each piece of the eligible lines only", () => {
    const code = rules({ minEligiblePieces: 3, eligibility: { scope: "selected", include: [{ type: "product", id: 10 }], exclude: [] } });
    const lines = [variantLine({ original: 5, qty: 2 }), variantLine({ original: 5, qty: 5, productId: 11 })];
    assert.deepEqual(pricing(code, lines), { ok: false, reason: "min_pieces", missingPieces: 1 });
    assert.equal(pricing(code, [variantLine({ original: 5, qty: 3 })]).ok, true);
  });

  test("a code with nothing to discount and no other benefit has no effect", () => {
    const code = rules({ eligibility: { scope: "selected", include: [{ type: "product", id: 999 }], exclude: [] } });
    assert.deepEqual(pricing(code, [variantLine({ original: 10 })]), { ok: false, reason: "no_effect" });
  });

  test("a code limited to chosen items gives no free delivery or gift to a cart without any of them", () => {
    const code = rules({ freeShipping: true, hasGift: true, eligibility: { scope: "selected", include: [{ type: "product", id: 999 }], exclude: [] } });
    assert.deepEqual(pricing(code, [variantLine({ original: 10 })], { giftAvailable: true }), { ok: false, reason: "no_effect" });
  });

  test("a gift-only code works while the gift is available and is refused when it is not", () => {
    const giftOnly = rules({ discountType: null, discountValue: null, hasGift: true });
    assert.equal(pricing(giftOnly, [variantLine({ original: 10 })], { giftAvailable: true }).ok, true);
    assert.deepEqual(pricing(giftOnly, [variantLine({ original: 10 })], { giftAvailable: false }), { ok: false, reason: "gift_unavailable" });
    // With free delivery as well, the code still applies without its gift.
    const withDelivery = success(pricing({ ...giftOnly, freeShipping: true }, [variantLine({ original: 10 })], { giftAvailable: false }));
    assert.equal(withDelivery.gift, false);
    assert.equal(withDelivery.freeShipping, true);
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
