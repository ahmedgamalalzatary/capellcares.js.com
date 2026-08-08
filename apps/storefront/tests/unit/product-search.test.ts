import { describe, expect, it } from "vitest";
import type { Product } from "@capella/shared";

import { matchesProductQuery } from "@/lib/product-search";

// The product from the bug report: an English display name with an Arabic name
// that shares no words with it, plus keywords in both languages.
const aloe = {
  name: { ar: "لوشن للجسم برائحة الصبار", en: "ALOE VERA" },
  keywords: ["لوشن", "لوشن للجسم", "تعطير الجسم", "رائحة الموز", "lotion", "aloe vera", "body lotion"]
} as Pick<Product, "name" | "keywords">;

describe("matchesProductQuery", () => {
  it("matches a prefix of the English name", () => {
    expect(matchesProductQuery(aloe, "l")).toBe(true);
    expect(matchesProductQuery(aloe, "lo")).toBe(true);
  });

  it("matches on keywords the name does not contain", () => {
    // "lotion" appears only in the keywords — this is the case that used to
    // preview in the overlay and then land on an empty results page.
    expect(matchesProductQuery(aloe, "lotion")).toBe(true);
    expect(matchesProductQuery(aloe, "body lotion")).toBe(true);
  });

  it("matches the other language's name regardless of the page locale", () => {
    expect(matchesProductQuery(aloe, "الصبار")).toBe(true);
    expect(matchesProductQuery(aloe, "لوشن")).toBe(true);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(matchesProductQuery(aloe, "  ALoE  ")).toBe(true);
    expect(matchesProductQuery(aloe, "LOTION")).toBe(true);
  });

  it("rejects a term that appears in neither name nor keywords", () => {
    expect(matchesProductQuery(aloe, "shampoo")).toBe(false);
    expect(matchesProductQuery(aloe, "زيت")).toBe(false);
  });

  it("treats an empty term as no constraint", () => {
    expect(matchesProductQuery(aloe, "")).toBe(true);
    expect(matchesProductQuery(aloe, "   ")).toBe(true);
  });

  it("survives a product with missing name or keywords", () => {
    expect(matchesProductQuery({} as Pick<Product, "name" | "keywords">, "aloe")).toBe(false);
    expect(matchesProductQuery({ name: { ar: "", en: "Aloe" } } as Pick<Product, "name" | "keywords">, "aloe")).toBe(true);
  });
});
