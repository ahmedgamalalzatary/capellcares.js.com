import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/products/product-card", async () => {
  const { useCardImageSwipe } = await vi.importActual<typeof import("@/components/ui/card-image-carousel")>("@/components/ui/card-image-carousel");
  return {
    ProductCard: ({ product }: any) =>
      createElement("div", { "data-testid": "popular-card", "data-swipe": String(useCardImageSwipe()) }, product.name.en)
  };
});

vi.mock("@/lib/api/client", () => {
  const discountedProduct = {
    id: 1,
    sku: "SKU-1",
    slug: "rose-serum",
    name: { ar: "سيروم الورد", en: "Rose Serum" },
    description: { ar: "", en: "" },
    ingredients: { ar: "", en: "" },
    howToUse: { ar: "", en: "" },
    warnings: { ar: "", en: "" },
    keywords: [],
    buyingPrice: 100,
    imagePath: "/rose.png",
    status: "active",
    isNew: false,
    isBestseller: false,
    categoryId: 1,
    variants: [
      {
        id: 11,
        productId: 1,
        size: "30ml",
        price: 200,
        stock: 4,
        discount: {
          type: "percentage",
          value: 50,
          startsAt: "2000-01-01T00:00:00.000Z",
          endsAt: "2999-01-01T00:00:00.000Z",
          status: "active"
        }
      }
    ],
    createdAt: "",
    updatedAt: ""
  };

  return {
    fetchProducts: vi.fn().mockResolvedValue([discountedProduct]),
    fetchCategories: vi.fn().mockResolvedValue([
      {
        id: 2,
        parentId: null,
        slug: "face-serums",
        name: { ar: "سيروم الوجه", en: "Rose Serums" },
        isLeaf: true,
        deletedAt: null
      }
    ]),
    fetchOffers: vi.fn().mockResolvedValue([
      {
        id: 3,
        slug: "rose-offer",
        name: { ar: "عرض الورد", en: "Rose Offer" },
        price: 150,
        originalTotal: 200,
        status: "active",
        deletedAt: null
      }
    ]),
    fetchCollections: vi.fn().mockResolvedValue([
      {
        id: 4,
        slug: "rose-routine",
        name: { ar: "روتين الورد", en: "Rose Routine" },
        price: 250,
        originalTotal: 300,
        status: "active",
        visibility: "visible",
        deletedAt: null
      }
    ])
  };
});

import { SearchOverlay } from "@/components/layout/header/search-overlay";

describe("SearchOverlay", () => {
  it("shows products, categories, offers, and collections for a global search", async () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn() }));

    fireEvent.change(screen.getByPlaceholderText(dict.nav.search), { target: { value: "rose" } });

    expect(await screen.findByText(dict.ask.sections.products)).toBeInTheDocument();
    expect(screen.getByText(dict.ask.sections.categories)).toBeInTheDocument();
    expect(screen.getByText(dict.ask.sections.offers)).toBeInTheDocument();
    expect(screen.getByText(dict.ask.sections.collections)).toBeInTheDocument();
    expect(screen.getByText("Rose Serum").closest("a")).toHaveAttribute("href", "/en/products/rose-serum");
    expect(screen.getByRole("link", { name: "Rose Serums" })).toHaveAttribute(
      "href",
      "/en/category/face-serums?categoryId=2"
    );
    expect(screen.getByRole("link", { name: /Rose Offer/ })).toHaveAttribute("href", "/en/offers/rose-offer");
    expect(screen.getByRole("link", { name: /Rose Routine/ })).toHaveAttribute(
      "href",
      "/en/collections/rose-routine"
    );
  });

  it("sends View all to the global results page, which carries every kind of match", async () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn() }));

    fireEvent.change(screen.getByPlaceholderText(dict.nav.search), { target: { value: "rose" } });
    fireEvent.click(await screen.findByRole("button", { name: dict.nav.viewAll }));

    // Not /products: the dropdown previews offers and collections too, so the page behind it must be able to show them.
    expect(push).toHaveBeenCalledWith("/en/search?q=rose");
  });

  it("locks page scroll while open and restores it on close", () => {
    const dict = getDict("en");
    const { rerender, unmount } = render(
      createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn() })
    );

    // <html> is the scrolling element — locking only <body> lets mobile browsers keep scrolling the page behind the overlay.
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    rerender(createElement(SearchOverlay, { lang: "en", dict, open: false, onClose: vi.fn() }));
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");

    rerender(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn() }));
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    // Unmounting mid-open (e.g. a route change) must not leave the page locked.
    unmount();
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and stops listening once closed", () => {
    const dict = getDict("en");
    const onClose = vi.fn();
    const { rerender } = render(
      createElement(SearchOverlay, { lang: "en", dict, open: true, onClose })
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(createElement(SearchOverlay, { lang: "en", dict, open: false, onClose }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes when the backdrop behind the overlay is clicked but not the panel itself", () => {
    const dict = getDict("en");
    const onClose = vi.fn();
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    // The backdrop sits outside the dialog panel.
    fireEvent.click(dialog.parentElement!.querySelector("div.absolute") as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from its own back control", () => {
    const dict = getDict("en");
    const onClose = vi.fn();
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose }));

    fireEvent.click(screen.getByRole("button", { name: dict.common.back }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the effective discounted price in search results, not the original price", async () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn() }));

    fireEvent.change(screen.getByPlaceholderText(dict.nav.search), { target: { value: "rose" } });

    expect(await screen.findByText(/EGP\s*100/)).toBeInTheDocument();
    expect(screen.queryByText(/EGP\s*200/)).not.toBeInTheDocument();
  });

  const popular = (id: number) => ({
    id, sku: `S${id}`, slug: `toy-${id}`, name: { ar: `لعبة ${id}`, en: `Toy ${id}` },
    description: { ar: "", en: "" }, ingredients: { ar: "", en: "" }, howToUse: { ar: "", en: "" }, warnings: { ar: "", en: "" },
    keywords: [], buyingPrice: 1, imagePath: null, status: "active" as const, isNew: false, isBestseller: true, categoryId: 1,
    variants: [{ id: id * 10, productId: id, size: "", price: 10, stock: 3, sortOrder: 1 }], createdAt: "", updatedAt: ""
  });
  const bestsellers = Array.from({ length: 12 }, (_, index) => popular(index + 1));
  const categories = [
    { key: "c1", label: "Scooters", href: "/en/category/scooters?categoryId=1" },
    { key: "c2", label: "Lego", href: "/en/category/lego?categoryId=2" }
  ];

  it("before typing, shows 6 best-seller names, the main categories and 10 best-seller cards", () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn(), bestsellers, categories } as any));

    const words = screen.getByRole("region", { name: dict.nav.popularSearches });
    const wordLinks = Array.from(words.querySelectorAll("a"));
    expect(wordLinks.map((link) => link.textContent)).toEqual(["Toy 1", "Toy 2", "Toy 3", "Toy 4", "Toy 5", "Toy 6"]);
    expect(wordLinks[0]).toHaveAttribute("href", "/en/products/toy-1");

    const cats = screen.getByRole("region", { name: dict.ask.sections.categories });
    expect(Array.from(cats.querySelectorAll("a"), (link) => link.getAttribute("href"))).toEqual(categories.map((c) => c.href));

    expect(screen.getByRole("region", { name: dict.nav.mostPopular })).toBeInTheDocument();
    expect(screen.getAllByTestId("popular-card")).toHaveLength(10);
  });

  it("swaps the suggestions for live results once the shopper types", async () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn(), bestsellers, categories } as any));

    fireEvent.change(screen.getByPlaceholderText(dict.nav.search), { target: { value: "rose" } });

    expect(await screen.findByText(dict.ask.sections.products)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: dict.nav.popularSearches })).toBeNull();
  });
  it("keeps the card row's side padding visible: scrolling snaps to the padding, not the row's edge", () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn(), bestsellers, categories } as any));
    const row = screen.getByTestId("search-popular-row");
    expect(row.className.split(" ")).toEqual(expect.arrayContaining(["px-5", "scroll-px-5"]));
  });

  it("gives desktop shoppers previous/next arrows for the card row", () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn(), bestsellers, categories } as any));
    const region = screen.getByRole("region", { name: dict.nav.mostPopular });
    expect(region.querySelector(`button[aria-label="${dict.common.previous}"]`)).not.toBeNull();
    expect(region.querySelector(`button[aria-label="${dict.common.next}"]`)).not.toBeNull();
  });

  it("turns the card picture swipe off, so a sideways swipe scrolls the row", () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn(), bestsellers, categories } as any));
    for (const card of screen.getAllByTestId("popular-card")) expect(card).toHaveAttribute("data-swipe", "false");
  });

  it("puts popular searches and categories on one sideways line on phones, wrapping from the sm width up", () => {
    const dict = getDict("en");
    render(createElement(SearchOverlay, { lang: "en", dict, open: true, onClose: vi.fn(), bestsellers, categories } as any));
    for (const name of [dict.nav.popularSearches, dict.ask.sections.categories]) {
      const line = screen.getByRole("region", { name }).querySelector("a")!.parentElement!;
      const classes = line.className.split(" ");
      expect(classes).toEqual(expect.arrayContaining(["overflow-x-auto", "sm:flex-wrap"]));
      expect(classes).not.toContain("flex-wrap");
    }
  });
});
