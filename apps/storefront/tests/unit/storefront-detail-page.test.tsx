import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("notFound");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound()
}));

vi.mock("@capella/shared", () => ({
  getDict: (lang: "ar" | "en") => ({ locale: lang }),
  languages: ["en", "ar"]
}));

import {
  StorefrontJsonLd,
  requireStorefrontValue,
  resolveStorefrontSlugPageContext
} from "@/lib/storefront-detail-page";

describe("storefront detail page helpers", () => {
  it("returns lang, slug, and dict for slug pages", async () => {
    await expect(resolveStorefrontSlugPageContext(Promise.resolve({ lang: "en", slug: "rose-serum" }))).resolves.toEqual({
      lang: "en",
      slug: "rose-serum",
      dict: { locale: "en" }
    });
  });

  it("calls notFound when a required storefront value is missing", () => {
    expect(() => requireStorefrontValue(null)).toThrow("notFound");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders one json-ld script per payload", () => {
    render(<StorefrontJsonLd payloads={[{ "@type": "Thing", name: "One" }, { "@type": "Thing", name: "Two" }]} />);

    const scripts = screen.getAllByTestId("json-ld-script");
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.innerHTML).toContain("\"One\"");
    expect(scripts[1]?.innerHTML).toContain("\"Two\"");
  });
});
