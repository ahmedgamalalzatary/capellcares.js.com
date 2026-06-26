import { describe, expect, it } from "vitest";
import { localeFromPathname, withLocale, resolveLocaleRedirect } from "@/lib/locale";

describe("localeFromPathname", () => {
  it("returns the locale when the path is prefixed", () => {
    expect(localeFromPathname("/en/shop")).toBe("en");
    expect(localeFromPathname("/ar")).toBe("ar");
  });

  it("returns null when there is no locale prefix", () => {
    expect(localeFromPathname("/shop")).toBeNull();
    expect(localeFromPathname("/")).toBeNull();
  });
});

describe("withLocale", () => {
  it("swaps an existing locale prefix", () => {
    expect(withLocale("/en/shop", "ar")).toBe("/ar/shop");
    expect(withLocale("/ar", "en")).toBe("/en");
  });

  it("inserts a locale when none is present", () => {
    expect(withLocale("/shop", "ar")).toBe("/ar/shop");
    expect(withLocale("/", "en")).toBe("/en");
  });
});

describe("resolveLocaleRedirect", () => {
  it("redirects unprefixed paths to the default locale", () => {
    expect(resolveLocaleRedirect("/")).toBe("/en");
    expect(resolveLocaleRedirect("/shop")).toBe("/en/shop");
  });

  it("leaves already-localized paths untouched", () => {
    expect(resolveLocaleRedirect("/en/shop")).toBeNull();
    expect(resolveLocaleRedirect("/ar/shop")).toBeNull();
  });
});
