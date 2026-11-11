import { describe, expect, it } from "vitest";
import { defaultLanguage } from "@capella/shared";

import { config, proxy } from "@/proxy";

const request = (path: string) => ({ nextUrl: new URL(`http://localhost${path}`), url: `http://localhost${path}` }) as any;
const matches = (path: string) => config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(path));

describe("storefront proxy", () => {
  it("skips API, crawler endpoints and every public file (anything with an extension) in the matcher", () => {
    for (const path of ["/_next/static/a.js", "/api/revalidate", "/sitemap.xml", "/robots.txt", "/favicon.ico", "/icon.png", "/logo-header.png"]) {
      expect(matches(path)).toBe(false);
    }
    for (const path of ["/", "/shop", "/en/shop", "/ar/products/rose-serum"]) {
      expect(matches(path)).toBe(true);
    }
  });

  it("sends the bare domain to the app's default language, the same one the root page uses", () => {
    const response = proxy(request("/"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`http://localhost/${defaultLanguage}`);
  });

  it("redirects paths without a language to the default language", () => {
    const response = proxy(request("/products"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`http://localhost/${defaultLanguage}/products`);
  });

  it("passes the page's language on, so <html lang/dir> match it", () => {
    for (const lang of ["ar", "en"]) {
      const response = proxy(request(`/${lang}/products`));
      expect(response?.status).toBe(200);
      expect(response?.headers.get("x-middleware-request-x-capella-locale")).toBe(lang);
    }
  });
});
