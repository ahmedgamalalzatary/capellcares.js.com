import { describe, expect, it } from "vitest";

import { config, proxy } from "../../proxy";

describe("storefront proxy", () => {
  it("skips API and crawler endpoints in the matcher", () => {
    expect(config.matcher).toEqual(["/((?!_next|api|favicon.ico|sitemap.xml|robots.txt).*)"]);
  });

  it("redirects unknown paths to the default locale", () => {
    const response = proxy({
      nextUrl: new URL("http://localhost/products"),
      url: "http://localhost/products"
    } as any);

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("http://localhost/ar/products");
  });

  it("does not redirect localized paths", () => {
    const response = proxy({
      nextUrl: new URL("http://localhost/ar/products"),
      url: "http://localhost/ar/products"
    } as any);

    expect(response?.status).toBe(200);
  });
});
