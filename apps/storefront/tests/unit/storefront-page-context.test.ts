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

import { resolveStorefrontLang, resolveStorefrontPageContext } from "@/lib/storefront-page-context";

describe("resolveStorefrontPageContext", () => {
  it("returns the validated language for broader route params", async () => {
    await expect(resolveStorefrontLang(Promise.resolve({ lang: "ar", slug: "rose" }))).resolves.toBe("ar");
  });

  it("returns a typed storefront page context for a supported language", async () => {
    await expect(resolveStorefrontPageContext(Promise.resolve({ lang: "en" }))).resolves.toEqual({
      lang: "en",
      dict: { locale: "en" }
    });
  });

  it("calls notFound for an unsupported language", async () => {
    await expect(resolveStorefrontPageContext(Promise.resolve({ lang: "fr" }))).rejects.toThrow("notFound");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
