import { describe, expect, it } from "vitest";
import {
  cairoInputFromInstant,
  createEmptyPromoForm,
  instantFromCairoInput,
  describePromoBenefits,
  promoErrorMessage,
  promoFormFromCode,
  validatePromoForm,
  type PromoCodeDetail
} from "@/features/promos/lib/promo-form";

const filled = () => ({
  ...createEmptyPromoForm(),
  code: "summer20",
  arName: "خصم الصيف",
  enName: "Summer sale",
  discountType: "percentage" as const,
  discountValue: "20"
});

describe("validatePromoForm", () => {
  it("turns the form into the API payload with numbers, nulls for empty fields and the code upper-cased", () => {
    const result = validatePromoForm({ ...filled(), maxDiscountAmount: "150", minOrderAmount: "300", totalUsageLimit: "100" });
    expect(result.errors).toEqual([]);
    expect(result.payload).toMatchObject({
      code: "SUMMER20",
      discountType: "percentage",
      discountValue: 20,
      maxDiscountAmount: 150,
      minOrderAmount: 300,
      maxOrderAmount: null,
      totalUsageLimit: 100,
      perCustomerLimit: null,
      startsAt: null,
      endsAt: null,
      gift: null,
      eligibility: { scope: "all", include: [], exclude: [] },
      customerIds: []
    });
  });

  it("reads schedule times as Cairo time whatever the browser's time zone, including summer time", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    const result = validatePromoForm({ ...filled(), startsAt: "2030-01-01T10:00", endsAt: "2030-07-01T10:00" });
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
    expect(result.payload?.startsAt).toBe("2030-01-01T08:00:00.000Z");
    expect(result.payload?.endsAt).toBe("2030-07-01T07:00:00.000Z");
  });

  it("shows a stored instant back in Cairo time when duplicating with its schedule", () => {
    expect(cairoInputFromInstant("2030-01-01T08:00:00.000Z")).toBe("2030-01-01T10:00");
    expect(cairoInputFromInstant("2030-07-01T07:00:00.000Z")).toBe("2030-07-01T10:00");
    expect(instantFromCairoInput("2030-07-01T10:00")).toBe("2030-07-01T07:00:00.000Z");
  });

  it("refuses a time skipped when Cairo moves its clock forward, instead of silently saving another hour", () => {
    // 24 April 2026: 00:00 becomes 01:00, so 00:30 never happens.
    expect(instantFromCairoInput("2026-04-24T00:30")).toBeNull();
    const result = validatePromoForm({ ...filled(), startsAt: "2026-04-24T00:30" });
    expect(result.payload).toBeNull();
    expect(result.errors).toContain("الوقت 2026-04-24 00:30 غير موجود في توقيت القاهرة بسبب تقديم الساعة. اختاري وقتًا آخر.");
  });

  it("reads a time that happens twice when Cairo moves its clock back as the first one (still summer time)", () => {
    // 29 October 2026: 24:00 becomes 23:00, so 23:30 happens at 20:30 and again at 21:30 UTC.
    expect(instantFromCairoInput("2026-10-29T23:30")).toBe("2026-10-29T20:30:00.000Z");
    expect(instantFromCairoInput("2026-10-29T22:30")).toBe("2026-10-29T19:30:00.000Z");
  });

  it("includes the gift and private customers only when switched on", () => {
    const result = validatePromoForm({
      ...filled(),
      giftEnabled: true, giftItemType: "offer", giftItemId: "4", giftQty: "2",
      isPrivate: true, customers: [{ id: 9, name: "Mona", email: "mona@example.com" }]
    });
    expect(result.payload?.gift).toEqual({ itemType: "offer", itemId: 4, qty: 2 });
    expect(result.payload?.customerIds).toEqual([9]);
    expect(validatePromoForm({ ...filled(), giftItemId: "4", customers: [{ id: 9, name: "Mona", email: "m@x.com" }] }).payload).toMatchObject({ gift: null, customerIds: [] });
  });

  it("returns Arabic messages for every broken rule and no payload", () => {
    const result = validatePromoForm({ ...createEmptyPromoForm(), code: "a b" });
    expect(result.payload).toBeNull();
    expect(result.errors).toContain(promoErrorMessage("promo.code_invalid"));
    expect(result.errors).toContain(promoErrorMessage("promo.benefit_required"));
    expect(result.errors).toContain("أدخلي الاسم بالعربية والإنجليزية.");
  });

  it("rejects text typed into number fields instead of silently dropping it", () => {
    const result = validatePromoForm({ ...filled(), perCustomerLimit: "abc" });
    expect(result.payload).toBeNull();
    expect(result.errors).toEqual(["قيمة غير صالحة: الحد لكل عميل."]);
  });
});

describe("promoErrorMessage", () => {
  it("explains API errors in Arabic, with a fallback for unknown keys", () => {
    expect(promoErrorMessage("promo.code_taken")).toBe("هذا الكود مستخدم من قبل. اختاري كودًا آخر.");
    expect(promoErrorMessage("something.else")).toBe("تعذر حفظ الكود. راجعي البيانات وحاولي مرة أخرى.");
  });
});

const detail = (overrides: Partial<PromoCodeDetail> = {}): PromoCodeDetail => ({
  id: 3, code: "SUMMER20", arName: "خصم الصيف", enName: "Summer", status: "active",
  startsAt: "2030-01-01T08:00:00.000Z", endsAt: null,
  discountType: "percentage", discountValue: 20, maxDiscountAmount: 100, freeShipping: true,
  gift: { itemType: "product_variant", itemId: 5, qty: 1 },
  eligibilityScope: "selected", eligibility: { scope: "selected", include: [{ type: "category", id: 2 }], exclude: [] },
  minOrderAmount: 200, maxOrderAmount: null, minEligiblePieces: 2, maxDiscountedPieces: null,
  totalUsageLimit: 50, perCustomerLimit: 1, firstOrderOnly: false, isPrivate: true, showInAccount: false,
  createdAt: "2029-12-01T00:00:00.000Z",
  usage: { used: 4, reserved: 1, released: 2, overLimit: 0 },
  customers: [{ id: 9, name: "Mona", email: "mona@example.com" }],
  events: [],
  ...overrides
});

describe("promoFormFromCode (duplicate as new)", () => {
  it("copies every rule but leaves the code and the schedule empty for the new code", () => {
    const form = promoFormFromCode(detail());
    expect(form.code).toBe("");
    expect(form.startsAt).toBe("");
    expect(form.endsAt).toBe("");
    expect(form).toMatchObject({
      arName: "خصم الصيف", discountType: "percentage", discountValue: "20", maxDiscountAmount: "100", freeShipping: true,
      giftEnabled: true, giftItemType: "product_variant", giftItemId: "5", giftQty: "1",
      scope: "selected", include: [{ type: "category", id: 2 }], minOrderAmount: "200", minEligiblePieces: "2",
      totalUsageLimit: "50", perCustomerLimit: "1", isPrivate: true
    });
    expect(form.customers).toEqual([{ id: 9, name: "Mona", email: "mona@example.com" }]);
    expect(validatePromoForm({ ...form, code: "SUMMER21" }).errors).toEqual([]);
  });
});

describe("describePromoBenefits", () => {
  it("lists every benefit in Arabic", () => {
    expect(describePromoBenefits(detail())).toEqual(["خصم 20%، بحد أقصى 100 ج.م", "شحن مجاني", "هدية مجانية"]);
    expect(describePromoBenefits(detail({ discountType: "fixed", discountValue: 50, maxDiscountAmount: null, freeShipping: false, gift: null }))).toEqual(["خصم 50 ج.م"]);
  });
});
