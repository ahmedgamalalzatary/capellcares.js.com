import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

const remove = vi.fn();
const toggle = vi.fn();

// The view resolves each saved entry against the catalog and renders the real
// ProductCard / SectionCard, so the fetchers must return matching records.
// Fixtures live inside the factory because vi.mock is hoisted above the file.
vi.mock("@/lib/api/client", () => {
  const product = {
    id: 11,
    sku: "SKU-11",
    slug: "body-mist",
    name: { ar: "بودي ميست", en: "Body Mist" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 50,
    imagePath: "/uploads/product.jpg",
    hoverImagePath: null,
    media: [],
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 2,
    variants: [{ id: 111, productId: 11, size: "30ml", price: 120, stock: 5 }],
    createdAt: "",
    updatedAt: ""
  };

  const offer = {
    id: 7,
    slug: "bundle-offer",
    name: { ar: "عرض", en: "Bundle Offer" },
    description: { ar: "", en: "" },
    imagePath: "/uploads/offer.jpg",
    media: [],
    price: 300,
    originalTotal: 400,
    stock: 3,
    status: "active",
    visibility: "visible",
    items: [],
    categoryId: 1,
    createdAt: "",
    updatedAt: ""
  };

  // Two distinct categories so the product's line and the offer's line can be
  // told apart in the assertions.
  const categories = [
    {
      id: 1,
      parentId: null,
      slug: "skin-care",
      name: { ar: "العناية بالبشرة", en: "Skin Care" },
      isLeaf: true,
      sortOrder: 1,
      deletedAt: null
    },
    {
      id: 2,
      parentId: null,
      slug: "body-care",
      name: { ar: "العناية بالجسم", en: "Body Care" },
      isLeaf: true,
      sortOrder: 2,
      deletedAt: null
    }
  ];

  return {
    fetchProducts: vi.fn().mockResolvedValue([product]),
    fetchOffers: vi.fn().mockResolvedValue([offer]),
    fetchCollections: vi.fn().mockResolvedValue([]),
    fetchCategories: vi.fn().mockResolvedValue(categories)
  };
});

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({
    ids: ["product:11", "offer:7", "collection:3"],
    items: [
      {
        entityType: "product",
        entityId: 11,
        name: { ar: "بودي ميست", en: "Body Mist" },
        imagePath: "/uploads/product.jpg",
        href: "/products/body-mist",
        availability: "available"
      },
      {
        entityType: "offer",
        entityId: 7,
        name: { ar: "عرض", en: "Bundle Offer" },
        imagePath: "/uploads/offer.jpg",
        href: "/offers/bundle-offer",
        availability: "available"
      },
      {
        // Not in the catalog: a hidden/deleted target that can only be cleared.
        entityType: "collection",
        entityId: 3,
        name: { ar: "تجميعة مخفية", en: "Hidden Collection" },
        imagePath: "/uploads/collection.jpg",
        href: null,
        availability: "unavailable"
      }
    ],
    has: () => true,
    toggle,
    remove
  })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { CartProvider } from "@/components/providers/cart-provider";
import { WishlistView } from "@/components/wishlist/wishlist-view";

const dict = {
  badges: { new: "New", bestseller: "Bestseller", offer: "Offer" },
  common: {
    loading: "Loading",
    outOfStock: "Unavailable",
    removeFromWishlist: "Remove",
    addToWishlist: "Add to wishlist",
    addToCart: "Add to cart",
    added: "Added",
    buyNow: "Buy now",
    quantity: "Quantity",
    filters: "Filters"
  },
  nav: { cart: "Cart", allProducts: "Products", offers: "Offers", collections: "Sets" },
  itemType: { product: "Product", offer: "Offer", collection: "Collection" },
  offers: { badge: "Offer", save: "Save {amount}" },
  collections: { badge: "Collection" },
  wishlist: {
    title: "Your wishlist",
    loginRequired: "Login required",
    loginRequiredDesc: "Login first",
    goLogin: "Log in",
    empty: "Empty",
    savedEmpty: "Nothing saved",
    itemTypes: {
      product: "Product",
      offer: "Offer",
      collection: "Collection"
    }
  },
  cart: { keepShopping: "Keep shopping", addToCart: "Add to cart", added: "Added" }
};

describe("WishlistView", () => {
  it("renders saved items as catalog cards and lets unavailable entries be removed", async () => {
    // The cards carry AddToCartControl, which needs the cart context.
    render(createElement(CartProvider, null, createElement(WishlistView, { lang: "en", dict })));

    // Its own page head, since this page opts out of StorefrontPageShell.
    expect(await screen.findByRole("heading", { level: 1, name: "Your wishlist" })).toBeInTheDocument();

    // Resolved entries become real cards. Each card links from both its media
    // and its title, so every link for an item points at its detail page.
    const productLinks = await screen.findAllByRole("link", { name: "Body Mist" });
    expect(productLinks.length).toBeGreaterThan(0);
    for (const link of productLinks) {
      expect(link).toHaveAttribute("href", "/en/products/body-mist");
    }
    for (const link of screen.getAllByRole("link", { name: "Bundle Offer" })) {
      expect(link).toHaveAttribute("href", "/en/offers/bundle-offer");
    }

    // The entry with no catalog match falls back to the clear-only row.
    expect(screen.getByText("Hidden Collection")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(remove).toHaveBeenCalledWith("collection", 3);
  });

  it("names a saved offer's category on its card", async () => {
    render(createElement(CartProvider, null, createElement(WishlistView, { lang: "en", dict })));

    expect(await screen.findByText("Skin Care")).toBeInTheDocument();
  });

  it("names a saved product's category on its card", async () => {
    render(createElement(CartProvider, null, createElement(WishlistView, { lang: "en", dict })));

    expect(await screen.findByText("Body Care")).toBeInTheDocument();
  });

  it("keeps the saved cards up when the category fetch fails", async () => {
    const { fetchCategories } = await import("@/lib/api/client");
    vi.mocked(fetchCategories).mockRejectedValueOnce(new Error("offline"));

    render(createElement(CartProvider, null, createElement(WishlistView, { lang: "en", dict })));

    // A missing category name costs the classification line, never the card.
    for (const link of await screen.findAllByRole("link", { name: "Bundle Offer" })) {
      expect(link).toHaveAttribute("href", "/en/offers/bundle-offer");
    }
  });

  it("offers the POV toggle once there are cards to re-flow", async () => {
    // The cards carry AddToCartControl, which needs the cart context.
    render(createElement(CartProvider, null, createElement(WishlistView, { lang: "en", dict })));

    expect(await screen.findByTestId("columns-toggle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2 per row" }));
    expect(screen.getByRole("button", { name: "2 per row" })).toHaveAttribute("aria-pressed", "true");
  });
});
