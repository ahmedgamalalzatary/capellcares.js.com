import { describe, expect, it } from "vitest";

import { authHref, resolveAuthDestination, sanitizeNext } from "@/lib/auth-redirect";

describe("sanitizeNext", () => {
  it("keeps a same-origin path, query string included", () => {
    expect(sanitizeNext("/en/orders", "en")).toBe("/en/orders");
    expect(sanitizeNext("/en/products?sort=new", "en")).toBe("/en/products?sort=new");
  });

  it("rejects targets that would leave the site", () => {
    // The value arrives through the URL, so a crafted link must not turn our
    // own login into an open redirect.
    expect(sanitizeNext("https://evil.example", "en")).toBeNull();
    expect(sanitizeNext("//evil.example", "en")).toBeNull();
    expect(sanitizeNext("/\\evil.example", "en")).toBeNull();
    expect(sanitizeNext("javascript:alert(1)", "en")).toBeNull();
  });

  it("refuses to bounce back to the auth pages themselves", () => {
    expect(sanitizeNext("/en/login", "en")).toBeNull();
    expect(sanitizeNext("/en/signup", "en")).toBeNull();
    expect(sanitizeNext("/ar/login", "ar")).toBeNull();
  });

  it("treats empty input as absent", () => {
    expect(sanitizeNext(null, "en")).toBeNull();
    expect(sanitizeNext("", "en")).toBeNull();
  });
});

describe("resolveAuthDestination", () => {
  it("falls back to the locale home when nothing trustworthy was passed", () => {
    expect(resolveAuthDestination(null, "en")).toBe("/en");
    expect(resolveAuthDestination("https://evil.example", "ar")).toBe("/ar");
  });

  it("returns the requested page when it is safe", () => {
    expect(resolveAuthDestination("/ar/wishlist", "ar")).toBe("/ar/wishlist");
  });
});

describe("authHref", () => {
  it("encodes the destination as a query param", () => {
    expect(authHref("login", "en", "/en/orders")).toBe("/en/login?next=%2Fen%2Forders");
  });

  it("omits the param when there is no usable destination", () => {
    expect(authHref("login", "en", null)).toBe("/en/login");
    expect(authHref("signup", "ar", "https://evil.example")).toBe("/ar/signup");
  });
});
