import { afterEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";
import { acceptPromoSales, fillTemplate, loadAcceptedPromoSales, loadPromoCode, promoRejectionMessage, salesSignature, savePromoCode } from "@/lib/promo/promo-code";

afterEach(() => {
  localStorage.clear();
});

describe("promo code storage", () => {
  it("keeps the typed code across pages and forgets it when removed", () => {
    expect(loadPromoCode()).toBe("");
    savePromoCode("summer20");
    expect(loadPromoCode()).toBe("summer20");
    savePromoCode(null);
    expect(loadPromoCode()).toBe("");
  });
});

describe("promo code storage when saving fails but reading works", () => {
  it("keeps the confirmation in memory until it can be saved", () => {
    savePromoCode("summer20");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    acceptPromoSales("sig");
    expect(loadAcceptedPromoSales()).toBe("sig");
    setItem.mockRestore();
    acceptPromoSales("sig2");
    expect(loadAcceptedPromoSales()).toBe("sig2");
    expect(localStorage.getItem("capella:promo-accepted")).toBe("sig2");
  });
});

describe("promo code storage without localStorage", () => {
  it("still keeps the code for this page when the browser blocks storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    savePromoCode("summer20");
    expect(loadPromoCode()).toBe("summer20");
    savePromoCode(null);
    expect(loadPromoCode()).toBe("");
    setItem.mockRestore(); getItem.mockRestore(); removeItem.mockRestore();
  });
});

describe("promoRejectionMessage", () => {
  it("explains each reason in the customer's language, filling amounts and counts", () => {
    const en = getDict("en");
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "not_found" }, en, "en")).toBe("This code doesn't exist.");
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "below_min", missingAmount: 120 }, en, "en")).toMatch(/^Add .*120.* more to use this code\.$/);
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "min_pieces", missingPieces: 1 }, en, "en")).toBe("Eligible items still needed for this code: 1.");
    const ar = getDict("ar");
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "first_order" }, ar, "ar")).toBe("هذا الكود للطلب الأول فقط.");
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "min_pieces", missingPieces: 1 }, ar, "ar")).toBe("عدد المنتجات المشمولة الناقصة لاستخدام هذا الكود: 1.");
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "below_min", missingAmount: 50 }, ar, "ar")).toMatch(/^أضيفي ما قيمته .*٥٠.* لاستخدام هذا الكود\.$/);
  });
});

describe("fillTemplate", () => {
  it("replaces every named placeholder", () => {
    expect(fillTemplate("{name}: {from} → {to}", { name: "Oil", from: "100", to: "90" })).toBe("Oil: 100 → 90");
  });
});

describe("accepted sale replacements", () => {
  const sales = [{ index: 1, nameAr: "ب", nameEn: "B", previousLineTotal: 5, lineTotal: 10 }, { index: 0, nameAr: "أ", nameEn: "A", previousLineTotal: 50, lineTotal: 90 }];

  it("are bound to the exact lines and prices the customer saw, in any order", () => {
    expect(salesSignature(sales)).toBe(salesSignature([...sales].reverse()));
    expect(salesSignature(sales)).not.toBe(salesSignature([{ ...sales[0]!, lineTotal: 11 }, sales[1]!]));
    expect(salesSignature([])).toBe("");
    // Another item at the same position and prices is a different replacement.
    expect(salesSignature([{ ...sales[0]!, item: "product_variant:1" }])).not.toBe(salesSignature([{ ...sales[0]!, item: "product_variant:2" }]));
  });

  it("are kept with the code and forgotten when the code changes", () => {
    savePromoCode("save10", salesSignature(sales));
    expect(loadAcceptedPromoSales()).toBe(salesSignature(sales));
    savePromoCode("other");
    expect(loadAcceptedPromoSales()).toBe("");
    acceptPromoSales("sig");
    expect(loadAcceptedPromoSales()).toBe("sig");
    savePromoCode(null);
    expect(loadAcceptedPromoSales()).toBe("");
  });
});
