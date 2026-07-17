import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { POST } from "@/app/api/revalidate/route";
import { NextRequest } from "next/server";

function request(body: unknown, secret = "dev-revalidate-secret") {
  return new NextRequest("http://localhost:3000/api/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-revalidate-secret": secret },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  revalidatePath.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/revalidate", () => {
  it("rejects a wrong secret", async () => {
    const response = await POST(request({ entity: "product" }, "wrong"));
    expect(response.status).toBe(401);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects an unknown entity", async () => {
    const response = await POST(request({ entity: "nonsense" }));
    expect(response.status).toBe(400);
  });

  it.each([null, [], "product", 7])("rejects a non-object payload: %j", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects inherited entity names", async () => {
    const response = await POST(request({ entity: "toString" }));
    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts an expanded path of exactly 1024 characters", async () => {
    const slug = "x".repeat(1024 - "/en/products/".length);
    const response = await POST(request({ entity: "product", slug }));
    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith(`/en/products/${slug}`);
  });

  it("rejects an expanded path over 1024 characters before revalidating anything", async () => {
    const slug = "x".repeat(1025 - "/en/products/".length);
    const response = await POST(request({ entity: "product", slug }));
    expect(response.status).toBe(400);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates product list pages and the changed slugs in both locales", async () => {
    const response = await POST(request({ entity: "product", slug: "new-slug", previousSlug: "old-slug" }));
    expect(response.status).toBe(200);

    const paths = revalidatePath.mock.calls.map(([path]) => path);
    for (const lang of ["ar", "en"]) {
      expect(paths).toContain(`/${lang}/products`);
      expect(paths).toContain(`/${lang}/newarrivals`);
      expect(paths).toContain(`/${lang}/bestsellers`);
      expect(paths).toContain(`/${lang}/products/new-slug`);
      expect(paths).toContain(`/${lang}/products/old-slug`);
    }
  });

  it("revalidates offer pages for offer payloads", async () => {
    await POST(request({ entity: "offer", slug: "bundle" }));
    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toContain("/en/offers");
    expect(paths).toContain("/en/offers/bundle");
    expect(paths).not.toContain("/en/products");
  });

  it("revalidates the product pages that embed a changed related item", async () => {
    await POST(request({ entity: "offer", slug: "bundle", relatedProductSlugs: ["shoe-a", "shoe-b"] }));
    const paths = revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toContain("/en/products/shoe-a");
    expect(paths).toContain("/ar/products/shoe-b");
  });

  it("refuses to run in production without a configured secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(request({ entity: "product" }));
    expect(response.status).toBe(503);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts a configured secret in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STOREFRONT_REVALIDATE_SECRET", "prod-secret");
    const response = await POST(request({ entity: "product", slug: "x" }, "prod-secret"));
    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalled();
  });
});
