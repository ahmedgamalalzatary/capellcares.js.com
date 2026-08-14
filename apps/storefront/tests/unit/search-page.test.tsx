import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/lib/storefront-page-context", () => ({
  resolveStorefrontLang: async () => "en"
}));

// The page's own composition is what is under test, so the cards are stubbed
// down to the two things this page must hand them: the entity and its category.
vi.mock("@/components/products/product-card", () => ({
  ProductCard: ({ product, categoryName }: any) =>
    createElement("div", { "data-testid": "product-card" }, `${product.name.en}${categoryName ? ` — ${categoryName}` : ""}`)
}));

vi.mock("@/components/shop/section-card", () => ({
  SectionCard: ({ kind, data, categoryName }: any) =>
    createElement("div", { "data-testid": `${kind}-card` }, `${data.name.en}${categoryName ? ` — ${categoryName}` : ""}`)
}));

const product = {
  id: 1,
  slug: "rose-serum",
  name: { ar: "سيروم الورد", en: "Rose Serum" },
  description: { ar: "", en: "" },
  keywords: [],
  imagePath: "/rose.png",
  status: "active" as const,
  isNew: false,
  isBestseller: false,
  categoryId: 1,
  variants: [{ id: 11, productId: 1, size: "30ml", price: 200, stock: 4 }],
  createdAt: "",
  updatedAt: ""
};

const offer = {
  id: 5,
  slug: "rose-bundle",
  name: { ar: "باقة الورد", en: "Rose Bundle" },
  description: { ar: "", en: "" },
  imagePath: "",
  price: 300,
  originalTotal: 400,
  categoryId: 1,
  items: [],
  stock: 3,
  status: "active" as const,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

const collection = {
  id: 9,
  slug: "rose-routine",
  name: { ar: "روتين الورد", en: "Rose Routine" },
  description: { ar: "", en: "" },
  imagePath: "",
  price: 500,
  originalTotal: 600,
  categoryId: 2,
  items: [],
  stock: 2,
  status: "active" as const,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

const categories = [
  { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: true, deletedAt: null },
  { id: 2, parentId: null, slug: "rose-care", name: { ar: "عناية الورد", en: "Rose Care" }, isLeaf: true, deletedAt: null }
];

const fetchProducts = vi.fn();
const fetchOffers = vi.fn();
const fetchCollections = vi.fn();
const fetchCategories = vi.fn();
const fetchAdvices = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/api/client", () => ({
  fetchProducts: (...args: unknown[]) => fetchProducts(...args),
  fetchOffers: (...args: unknown[]) => fetchOffers(...args),
  fetchCollections: (...args: unknown[]) => fetchCollections(...args),
  fetchCategories: (...args: unknown[]) => fetchCategories(...args),
  fetchAdvices: (...args: unknown[]) => fetchAdvices(...args)
}));

import SearchPage from "@/app/[lang]/search/page";

function renderPage(q: string | undefined) {
  return SearchPage({
    params: Promise.resolve({ lang: "en" }),
    searchParams: Promise.resolve(q === undefined ? {} : { q })
  } as any);
}

vi.mock("@/components/products/advice-section", () => ({
  AdviceSection: () => createElement("section", { "data-testid": "advice-section" }, "Capella Tips")
}));

describe("search results page", () => {
  const seedCatalog = () => {
    fetchProducts.mockResolvedValue([product]);
    fetchOffers.mockResolvedValue([offer]);
    fetchCollections.mockResolvedValue([collection]);
    fetchCategories.mockResolvedValue(categories);
  };

  it("shows every kind of match, not products alone", async () => {
    seedCatalog();

    render(await renderPage("rose"));

    expect(screen.getByTestId("product-card")).toHaveTextContent("Rose Serum");
    expect(screen.getByTestId("offer-card")).toHaveTextContent("Rose Bundle");
    expect(screen.getByTestId("collection-card")).toHaveTextContent("Rose Routine");
  });

  it("names each bundle's category, as every other card surface does", async () => {
    seedCatalog();

    render(await renderPage("rose"));

    expect(screen.getByTestId("offer-card")).toHaveTextContent("Rose Bundle — Skin Care");
    expect(screen.getByTestId("collection-card")).toHaveTextContent("Rose Routine — Rose Care");
    expect(screen.getByTestId("product-card")).toHaveTextContent("Rose Serum — Skin Care");
  });

  it("lists no categories: the results are offers, collections and products only", async () => {
    seedCatalog();

    render(await renderPage("rose"));

    // "Rose Care" matches the term by name, but a category is not a result here.
    expect(screen.queryByRole("link", { name: "Rose Care" })).toBeNull();
    // It is still fetched — the cards need it to name their classification line.
    expect(screen.getByTestId("collection-card")).toHaveTextContent("Rose Care");
  });

  // No page-head here by design: the breadcrumb leads straight into the rows,
  // so the query is echoed in the tab title (generateMetadata) rather than an h1.

  it("leaves out a kind that has no match instead of showing an empty section", async () => {
    fetchProducts.mockResolvedValue([product]);
    fetchOffers.mockResolvedValue([]);
    fetchCollections.mockResolvedValue([]);
    fetchCategories.mockResolvedValue(categories);

    render(await renderPage("rose"));

    expect(screen.getByTestId("product-card")).toBeInTheDocument();
    expect(screen.queryByTestId("offer-card")).toBeNull();
    expect(screen.queryByTestId("collection-card")).toBeNull();
  });

  it("matches offers and collections on their own names, not the product query", async () => {
    fetchProducts.mockResolvedValue([]);
    fetchOffers.mockResolvedValue([offer, { ...offer, id: 6, slug: "mint", name: { ar: "نعناع", en: "Mint Bundle" } }]);
    fetchCollections.mockResolvedValue([]);
    fetchCategories.mockResolvedValue(categories);

    render(await renderPage("rose"));

    const offers = screen.getAllByTestId("offer-card");
    expect(offers).toHaveLength(1);
    expect(offers[0]).toHaveTextContent("Rose Bundle");
  });

  it("hides inactive and hidden bundles from the results", async () => {
    fetchProducts.mockResolvedValue([]);
    fetchOffers.mockResolvedValue([{ ...offer, status: "inactive" as const }]);
    fetchCollections.mockResolvedValue([{ ...collection, visibility: "hidden" as const }]);
    fetchCategories.mockResolvedValue(categories);

    render(await renderPage("rose"));

    expect(screen.queryByTestId("offer-card")).toBeNull();
    expect(screen.queryByTestId("collection-card")).toBeNull();
  });

  it("says so plainly when the search finds nothing", async () => {
    fetchProducts.mockResolvedValue([]);
    fetchOffers.mockResolvedValue([]);
    fetchCollections.mockResolvedValue([]);
    fetchCategories.mockResolvedValue(categories);

    render(await renderPage("zzz"));

    expect(screen.queryByTestId("product-card")).toBeNull();
    // And a way out, rather than a dead end.
    expect(screen.getByRole("link", { name: /products/i })).toBeInTheDocument();
  });

  it("lays every section out as the shop's scrolling row", async () => {
    seedCatalog();

    const { container } = render(await renderPage("rose"));

    // ShopCardRow's signature: a snapping horizontal scroller per section.
    expect(container.querySelectorAll(".snap-x")).toHaveLength(3);
    for (const card of ["offer-card", "collection-card", "product-card"]) {
      expect(screen.getByTestId(card).closest(".snap-x")).not.toBeNull();
    }
  });

  it("orders the results offers, then collections, then products", async () => {
    seedCatalog();

    const { container } = render(await renderPage("rose"));

    const order = [...container.querySelectorAll("[data-testid$='-card']")].map((card) =>
      card.getAttribute("data-testid")
    );
    expect(order).toEqual(["offer-card", "collection-card", "product-card"]);
  });

  it("closes with Capella tips, after the results", async () => {
    seedCatalog();

    const { container } = render(await renderPage("rose"));

    const tips = screen.getByTestId("advice-section");
    const lastCard = [...container.querySelectorAll("[data-testid$='-card']")].at(-1)!;
    expect(lastCard.compareDocumentPosition(tips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("still offers the tips when the search itself found nothing", async () => {
    fetchProducts.mockResolvedValue([]);
    fetchOffers.mockResolvedValue([]);
    fetchCollections.mockResolvedValue([]);
    fetchCategories.mockResolvedValue(categories);

    render(await renderPage("zzz"));

    expect(screen.getByTestId("advice-section")).toBeInTheDocument();
  });

  it("asks the catalog for the shopper's term so the page can never contradict the dropdown", async () => {
    seedCatalog();

    render(await renderPage("rose"));

    expect(fetchProducts).toHaveBeenCalledWith(expect.objectContaining({ q: "rose", lang: "en" }));
  });
});
