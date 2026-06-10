import { afterEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args)
}));

describe("storefront revalidate route", () => {
  afterEach(() => {
    vi.resetModules();
    revalidatePath.mockReset();
  });

  it("revalidates localized product and listing paths for a valid ERP request", async () => {
    const { POST } = await import("@/app/api/revalidate/route");

    const response = await POST(new Request("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": "dev-revalidate-secret"
      },
      body: JSON.stringify({
        entity: "product",
        slug: "body-lotion-250"
      })
    }));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/shop");
    expect(revalidatePath).toHaveBeenCalledWith("/en/shop");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/products/[slug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/category/[slug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("revalidates all affected offer pages from a universal revalidation request", async () => {
    const { POST } = await import("@/app/api/revalidate/route");

    const response = await POST(new Request("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": "dev-revalidate-secret"
      },
      body: JSON.stringify({
        entity: "offer",
        slug: "summer-bundle",
        relatedProductSlugs: ["body-lotion-250", "argan-mask"]
      })
    }));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/ar/offers");
    expect(revalidatePath).toHaveBeenCalledWith("/en/offers");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/offers/summer-bundle");
    expect(revalidatePath).toHaveBeenCalledWith("/en/offers/summer-bundle");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products/argan-mask");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products/argan-mask");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/shop");
    expect(revalidatePath).toHaveBeenCalledWith("/en/shop");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/offers/[slug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/[lang]/products/[slug]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });

  it("revalidates product and category pages when categorySlugs are provided", async () => {
    const { POST } = await import("@/app/api/revalidate/route");

    const response = await POST(new Request("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": "dev-revalidate-secret"
      },
      body: JSON.stringify({
        entity: "product",
        slug: "body-lotion-250",
        categorySlugs: ["hair-care", "featured-products"]
      })
    }));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/category/hair-care");
    expect(revalidatePath).toHaveBeenCalledWith("/en/category/hair-care");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/category/featured-products");
    expect(revalidatePath).toHaveBeenCalledWith("/en/category/featured-products");
  });

  it("revalidates the previous product slug when the webhook payload provides it", async () => {
    const { POST } = await import("@/app/api/revalidate/route");

    const response = await POST(new Request("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": "dev-revalidate-secret"
      },
      body: JSON.stringify({
        entity: "product",
        slug: "renamed-product",
        previousSlug: "body-lotion-250"
      })
    }));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products/renamed-product");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products/renamed-product");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products/body-lotion-250");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products/body-lotion-250");
  });

  it("revalidates advice-backed pages without requiring a slug", async () => {
    const { POST } = await import("@/app/api/revalidate/route");

    const response = await POST(new Request("http://localhost:3000/api/revalidate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-revalidate-secret": "dev-revalidate-secret"
      },
      body: JSON.stringify({
        entity: "advice"
      })
    }));

    expect(response.status).toBe(200);
    expect(revalidatePath).toHaveBeenCalledWith("/ar/shop");
    expect(revalidatePath).toHaveBeenCalledWith("/en/shop");
    expect(revalidatePath).toHaveBeenCalledWith("/ar/products");
    expect(revalidatePath).toHaveBeenCalledWith("/en/products");
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
});
