import { describe, expect, it } from "vitest";
import {
  createEmptyPromoForm,
  instantFromKuwaitInput,
  kuwaitInputFromInstant,
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

  it("reads schedule times as Kuwait time (UTC+3 all year) whatever the browser's time zone", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    const result = validatePromoForm({ ...filled(), startsAt: "2030-01-01T10:00", endsAt: "2030-07-01T10:00" });
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
    expect(result.payload?.startsAt).toBe("2030-01-01T07:00:00.000Z");
    expect(result.payload?.endsAt).toBe("2030-07-01T07:00:00.000Z");
  });

  it("shows a stored instant back in Kuwait time when duplicating with its schedule", () => {
    expect(kuwaitInputFromInstant("2030-01-01T07:00:00.000Z")).toBe("2030-01-01T10:00");
    expect(kuwaitInputFromInstant("2030-12-31T22:30:00.000Z")).toBe("2031-01-01T01:30");
    expect(instantFromKuwaitInput("2031-01-01T01:30")).toBe("2030-12-31T22:30:00.000Z");
  });

  it("refuses a date that does not exist instead of saving another day", () => {
    expect(instantFromKuwaitInput("2026-02-30T10:00")).toBeNull();
    const result = validatePromoForm({ ...filled(), startsAt: "2026-02-30T10:00" });
    expect(result.payload).toBeNull();
    expect(result.errors).toContain("الوقت 2026-02-30 10:00 غير صالح. اختاري تاريخًا ووقتًا آخر.");
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
  usage: { used: 4, released: 2 },
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
    expect(describePromoBenefits(detail())).toEqual(["خصم 20%، بحد أقصى 100 د.ك", "توصيل مجاني", "هدية مجانية"]);
    expect(describePromoBenefits(detail({ discountType: "fixed", discountValue: 50, maxDiscountAmount: null, freeShipping: false, gift: null }))).toEqual(["خصم 50 د.ك"]);
  });
});
