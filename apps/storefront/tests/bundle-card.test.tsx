import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { BundleCard } from "@/components/bundles/BundleCard";
import type { StorefrontBundle } from "@/lib/bundles";

const offer: StorefrontBundle = {
  id: 9,
  slug: "summer-set",
  name: { ar: "طقم الصيف", en: "Summer set" },
  description: { ar: "", en: "" },
  imagePath: "/offer.png",
  price: 150,
  originalTotal: 200,
  stock: 3,
  status: "active",
  items: [{ variantId: 1, qty: 1 }, { variantId: 2, qty: 1 }]
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("BundleCard", () => {
  it("links to the bundle detail page and shows the save percentage", () => {
    render(<LocaleProvider lang="en"><BundleCard bundle={offer} kind="offer" /></LocaleProvider>);

    for (const link of screen.getAllByRole("link", { name: "Summer set" })) {
      expect(link).toHaveAttribute("href", "/en/offers/summer-set");
    }
    expect(screen.getByText(/-25%/)).toBeInTheDocument();
  });

  it("adds an offer line to the cart", () => {
    render(<LocaleProvider lang="en"><BundleCard bundle={offer} kind="offer" /></LocaleProvider>);

    fireEvent.click(screen.getByRole("button", { name: "ADD TO CART" }));

    expect(JSON.parse(localStorage.getItem("minikoshk_cart") ?? "[]")).toEqual([
      { type: "offer", offerId: 9, qty: 1 }
    ]);
    expect(screen.getByRole("button", { name: "Added" })).toBeInTheDocument();
  });

  it("disables purchase when the bundle is out of stock", () => {
    render(
      <LocaleProvider lang="en">
        <BundleCard bundle={{ ...offer, stock: 0 }} kind="collection" />
      </LocaleProvider>
    );

    expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  });
});
