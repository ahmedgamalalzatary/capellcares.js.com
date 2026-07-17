import { afterEach, describe, expect, it, vi } from "vitest";
import { bundleSavePercent, getOfferBySlug, getOffers, type StorefrontBundle } from "@/lib/bundles";

function bundle(overrides: Partial<StorefrontBundle> = {}): StorefrontBundle {
  return {
    id: 1,
    slug: "bundle",
    name: { ar: "باقة", en: "Bundle" },
    description: { ar: "", en: "" },
    imagePath: "/bundle.png",
    price: 80,
    originalTotal: 100,
    stock: 5,
    status: "active",
    items: [{ variantId: 1, qty: 2 }],
    ...overrides
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bundleSavePercent", () => {
  it("computes the discount against the original total", () => {
    expect(bundleSavePercent(bundle({ price: 80, originalTotal: 100 }))).toBe(20);
  });

  it("is 0 when the bundle costs the same or more than its items", () => {
    expect(bundleSavePercent(bundle({ price: 100, originalTotal: 100 }))).toBe(0);
    expect(bundleSavePercent(bundle({ price: 120, originalTotal: 100 }))).toBe(0);
  });
});

describe("bundle API calls", () => {
  it("lists only active bundles from GET /api/v1/offers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      items: [bundle({ id: 1 }), bundle({ id: 2, status: "inactive" })]
    }));
    vi.stubGlobal("fetch", fetchMock);

    const offers = await getOffers();

    expect(fetchMock.mock.calls[0][0]).toContain("/api/v1/offers");
    expect(offers.map((offer) => offer.id)).toEqual([1]);
  });

  it("propagates an unreachable API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(getOffers()).rejects.toThrow("down");
  });

  it("returns null for a missing offer slug", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Offer not found" }, 404)));
    expect(await getOfferBySlug("nope")).toBeNull();
  });

  it("propagates non-404 offer detail failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "broken" }, 500)));
    await expect(getOfferBySlug("broken")).rejects.toThrow("broken");
  });
});
