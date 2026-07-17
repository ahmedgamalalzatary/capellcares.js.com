import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function stubCatalog() {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => {
    if (String(url).includes("/offers")) {
      return Promise.resolve(jsonResponse({
        items: [{
          id: 1, slug: "bundle", name: { ar: "باقة", en: "Bundle" }, description: { ar: "", en: "" },
          imagePath: "", price: 100, originalTotal: 120, stock: 5, status: "active", items: []
        }]
      }));
    }
    return Promise.resolve(jsonResponse({ items: [] }));
  }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("CheckoutForm", () => {
  it("shows an order summary that excludes unavailable lines from the total", async () => {
    localStorage.setItem("minikoshk_cart", JSON.stringify([
      { type: "offer", offerId: 1, qty: 2 },
      { type: "product", variantId: 999, qty: 1 } // no longer in the catalog
    ]));
    stubCatalog();

    render(<LocaleProvider lang="en"><CheckoutForm /></LocaleProvider>);

    expect(await screen.findByText("Bundle × 2")).toBeInTheDocument();
    // Line total and grand total are both 200 — the dead line contributes nothing.
    expect(screen.getAllByText("200 EGP")).toHaveLength(2);
    expect(screen.getByText("#999 × 1")).toBeInTheDocument();
    expect(screen.getByText("This item is no longer available")).toBeInTheDocument();
  });

  it("renders governorates localized in Arabic while keeping English enum values", async () => {
    localStorage.setItem("minikoshk_cart", JSON.stringify([{ type: "offer", offerId: 1, qty: 1 }]));
    stubCatalog();

    render(<LocaleProvider lang="ar"><CheckoutForm /></LocaleProvider>);

    const cairo = await screen.findByRole("option", { name: "القاهرة" });
    expect(cairo).toHaveValue("Cairo");
  });
});
