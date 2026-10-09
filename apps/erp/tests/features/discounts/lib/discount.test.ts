import { describe, expect, it } from "vitest";
import type { ProductVariant } from "@capella/shared";
import {
  buildDiscountState,
  inCategory,
  previewPrice,
  toDateTimeLocal,
  toIsoOrEmpty,
  toggleId
} from "@/features/discounts/lib/discount";

describe("toggleId", () => {
  it("adds an id when it is absent", () => {
    expect(toggleId([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("removes an id when it is present", () => {
    expect(toggleId([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe("previewPrice", () => {
  it("applies a percentage discount", () => {
    expect(previewPrice(100, "percentage", 10)).toBe(90);
  });

  it("applies a fixed discount", () => {
    expect(previewPrice(100, "fixed", 30)).toBe(70);
  });

  it("ignores a non-positive value", () => {
    expect(previewPrice(100, "percentage", 0)).toBe(100);
  });

  it("never goes below zero", () => {
    expect(previewPrice(100, "fixed", 150)).toBe(0);
  });
});

describe("inCategory", () => {
  const parents = new Map<number, number | null>([[3, 2], [2, 1], [1, null], [9, null]]);

  it("matches an ancestor that is selected", () => {
    expect(inCategory(3, new Set([1]), parents)).toBe(true);
  });

  it("matches the category itself when selected", () => {
    expect(inCategory(2, new Set([2]), parents)).toBe(true);
  });

  it("returns false for a category outside the selected branch", () => {
    expect(inCategory(9, new Set([1]), parents)).toBe(false);
  });
});

describe("datetime helpers", () => {
  it("renders a local datetime-local value", () => {
    expect(toDateTimeLocal("2026-01-05T10:20")).toBe("2026-01-05T10:20");
  });

  it("returns an empty string for empty or invalid input", () => {
    expect(toDateTimeLocal("")).toBe("");
    expect(toDateTimeLocal("not-a-date")).toBe("");
  });

  it("round-trips an empty value and serialises a valid one", () => {
    expect(toIsoOrEmpty("")).toBe("");
    expect(toIsoOrEmpty("2026-01-05T10:20")).toBe(new Date("2026-01-05T10:20").toISOString());
  });
});

describe("buildDiscountState", () => {
  it("returns the variant discount when present", () => {
    const discount = { type: "fixed" as const, value: 5, startsAt: "", endsAt: "", status: "active" as const };
    const variant = { discount } as ProductVariant;

    expect(buildDiscountState(variant)).toBe(discount);
  });

  it("falls back to an inactive percentage discount", () => {
    const variant = { discount: null } as ProductVariant;

    expect(buildDiscountState(variant)).toEqual({ type: "percentage", value: 0, startsAt: "", endsAt: "", status: "inactive" });
  });
});
