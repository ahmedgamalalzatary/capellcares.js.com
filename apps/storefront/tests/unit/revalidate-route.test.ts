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
    expect(revalidatePath).toHaveBeenCalledWith("/sitemap.xml");
  });
});
