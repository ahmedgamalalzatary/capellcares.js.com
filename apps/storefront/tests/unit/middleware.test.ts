import { describe, expect, it } from "vitest";

import { config, middleware } from "../../middleware";

describe("storefront middleware", () => {
  it("skips API and crawler endpoints in the matcher", () => {
    expect(config.matcher).toEqual(["/((?!_next|api|favicon.ico|sitemap.xml|robots.txt).*)"]);
  });

  it("redirects unknown paths to the default locale", () => {
    const response = middleware({
      nextUrl: new URL("http://localhost/products"),
      url: "http://localhost/products"
    } as any);

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/ar/products");
  });

  it("does not redirect localized paths", () => {
    const response = middleware({
      nextUrl: new URL("http://localhost/ar/products"),
      url: "http://localhost/ar/products"
    } as any);

    expect(response?.status).toBe(200);
  });
});
