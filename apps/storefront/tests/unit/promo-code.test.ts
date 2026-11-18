import { afterEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";
import { fillTemplate, loadPromoCode, promoRejectionMessage, savePromoCode } from "@/lib/promo/promo-code";

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
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "min_pieces", missingPieces: 2 }, en, "en")).toBe("Add 2 more eligible items to use this code.");
    const ar = getDict("ar");
    expect(promoRejectionMessage({ status: "rejected", code: "X", reason: "first_order" }, ar, "ar")).toBe("هذا الكود للطلب الأول فقط.");
  });
});

describe("fillTemplate", () => {
  it("replaces every named placeholder", () => {
    expect(fillTemplate("{name}: {from} → {to}", { name: "Oil", from: "100", to: "90" })).toBe("Oil: 100 → 90");
  });
});
