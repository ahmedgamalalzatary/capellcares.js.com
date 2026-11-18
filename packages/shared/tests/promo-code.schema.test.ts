import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { generatePromoCode, normalizePromoCode, PROMO_CODE_ALPHABET, promoCodeCreateSchema } from "../src/schemas/promo-code.schema.js";

const valid = {
  code: "summer20",
  arName: "خصم الصيف",
  enName: "Summer sale",
  startsAt: null,
  endsAt: null,
  discountType: "percentage",
  discountValue: 20,
  maxDiscountAmount: null,
  freeShipping: false,
  gift: null,
  eligibility: { scope: "all", include: [], exclude: [] },
  minOrderAmount: null,
  maxOrderAmount: null,
  minEligiblePieces: null,
  maxDiscountedPieces: null,
  totalUsageLimit: null,
  perCustomerLimit: null,
  firstOrderOnly: false,
  isPrivate: false,
  customerIds: []
};

const issues = (body: unknown) => {
  const result = promoCodeCreateSchema.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("promo code text", () => {
  test("is matched without case or surrounding spaces", () => {
    assert.equal(normalizePromoCode("  Summer20 "), "SUMMER20");
  });

  test("generated codes use only characters that cannot be confused (no 0/O, 1/I/L)", () => {
    for (const char of "01OIL") assert.equal(PROMO_CODE_ALPHABET.includes(char), false, char);
    for (let i = 0; i < 50; i += 1) {
      const code = generatePromoCode();
      assert.match(code, /^[A-Z2-9]{8}$/);
      for (const char of code) assert.ok(PROMO_CODE_ALPHABET.includes(char));
    }
  });
});

describe("promoCodeCreateSchema", () => {
  test("accepts a complete code and stores the code text in its matching form", () => {
    const result = promoCodeCreateSchema.parse(valid);
    assert.equal(result.code, "SUMMER20");
  });

  test("accepts every benefit combined", () => {
    assert.deepEqual(issues({ ...valid, discountType: "fixed", discountValue: 50, freeShipping: true, gift: { itemType: "offer", itemId: 3, qty: 1 } }), []);
  });

  test("requires at least one benefit", () => {
    assert.deepEqual(issues({ ...valid, discountType: null, discountValue: null }), ["promo.benefit_required"]);
    assert.deepEqual(issues({ ...valid, discountType: null, discountValue: null, freeShipping: true }), []);
  });

  test("rejects code text with spaces or symbols, and too short or long", () => {
    for (const code of ["AB", "SUMMER 20", "SUMMER!", "X".repeat(33)]) assert.deepEqual(issues({ ...valid, code }), ["promo.code_invalid"], code);
    assert.deepEqual(issues({ ...valid, code: "eid-2026_a" }), []);
  });

  test("bounds discount values: percentage 0-100 exclusive of 0, fixed above 0, a cap only on percentages", () => {
    assert.deepEqual(issues({ ...valid, discountValue: 0 }), ["promo.discount_value_invalid"]);
    assert.deepEqual(issues({ ...valid, discountValue: 101 }), ["promo.discount_value_invalid"]);
    assert.deepEqual(issues({ ...valid, discountValue: null }), ["promo.discount_value_invalid"]);
    assert.deepEqual(issues({ ...valid, discountType: "fixed", discountValue: 0 }), ["promo.discount_value_invalid"]);
    assert.deepEqual(issues({ ...valid, discountType: "fixed", discountValue: 50, maxDiscountAmount: 20 }), ["promo.cap_percentage_only"]);
    assert.deepEqual(issues({ ...valid, maxDiscountAmount: 0 }), ["promo.cap_invalid"]);
    assert.deepEqual(issues({ ...valid, discountType: null, discountValue: 10, freeShipping: true }), ["promo.discount_value_invalid"]);
  });

  test("selected eligibility needs at least one included target", () => {
    assert.deepEqual(issues({ ...valid, eligibility: { scope: "selected", include: [], exclude: [] } }), ["promo.targets_required"]);
    assert.deepEqual(issues({ ...valid, eligibility: { scope: "selected", include: [{ type: "category", id: 4 }], exclude: [{ type: "product", id: 9 }] } }), []);
  });

  test("the amount range and the schedule must be in order", () => {
    assert.deepEqual(issues({ ...valid, minOrderAmount: 500, maxOrderAmount: 400 }), ["promo.amount_range_invalid"]);
    assert.deepEqual(issues({ ...valid, startsAt: "2026-12-02T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z" }), ["promo.schedule_invalid"]);
    assert.deepEqual(issues({ ...valid, startsAt: "2026-12-01T00:00:00.000Z", endsAt: "2026-12-02T00:00:00.000Z" }), []);
  });

  test("piece counts and usage limits are whole numbers of at least 1", () => {
    for (const key of ["minEligiblePieces", "maxDiscountedPieces", "totalUsageLimit", "perCustomerLimit"]) {
      assert.notDeepEqual(issues({ ...valid, [key]: 0 }), [], key);
      assert.notDeepEqual(issues({ ...valid, [key]: 1.5 }), [], key);
      assert.deepEqual(issues({ ...valid, [key]: 3 }), [], key);
    }
  });

  test("amounts must fit the stored precision and range, so nothing rounds to zero or fails to save", () => {
    assert.ok(issues({ ...valid, discountType: "fixed", discountValue: 0.001 }).includes("promo.discount_value_invalid"));
    assert.ok(issues({ ...valid, discountType: "fixed", discountValue: 100_000_000 }).includes("promo.discount_value_invalid"));
    assert.ok(issues({ ...valid, maxDiscountAmount: 10.005 }).includes("promo.cap_invalid"));
    assert.ok(issues({ ...valid, minOrderAmount: 0.001 }).length > 0);
    assert.ok(issues({ ...valid, maxOrderAmount: 100_000_000 }).length > 0);
    assert.deepEqual(issues({ ...valid, discountType: "fixed", discountValue: 99_999_999.99, minOrderAmount: 0.5 }), []);
  });

  test("counts fit the stored whole-number range", () => {
    assert.ok(issues({ ...valid, totalUsageLimit: 2_147_483_648 }).length > 0);
    assert.ok(issues({ ...valid, perCustomerLimit: 2_147_483_648 }).length > 0);
    assert.deepEqual(issues({ ...valid, totalUsageLimit: 2_147_483_647 }), []);
  });

  test("a private code needs its customers, and only a private code may list customers", () => {
    assert.deepEqual(issues({ ...valid, isPrivate: true }), ["promo.customers_required"]);
    assert.deepEqual(issues({ ...valid, isPrivate: true, customerIds: [5, 6] }), []);
    assert.deepEqual(issues({ ...valid, customerIds: [5] }), ["promo.customers_private_only"]);
  });

  test("a gift needs a whole quantity of at least 1", () => {
    assert.notDeepEqual(issues({ ...valid, gift: { itemType: "product_variant", itemId: 3, qty: 0 } }), []);
    assert.deepEqual(issues({ ...valid, gift: { itemType: "product_variant", itemId: 3, qty: 2 } }), []);
  });
});
