import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/shop/section-card", () => ({
  SectionCard: ({ data }: any) => createElement("div", { "data-testid": "offer-card" }, data.name.en)
}));

vi.mock("@/components/products/filters/mobile-filter-drawer", () => ({
  MobileFilterDrawer: () => createElement("div")
}));

vi.mock("@/components/ui/columns-toggle", () => ({
  ColumnsToggle: () => createElement("div")
}));

import { OfferGrid } from "@/components/offers/offer-grid";

const categories = [
  { id: 1, parentId: null, slug: "skin-care", name: { ar: "العناية بالبشرة", en: "Skin Care" }, isLeaf: false, sortOrder: 1, deletedAt: null },
  { id: 2, parentId: 1, slug: "creams", name: { ar: "كريمات", en: "Creams" }, isLeaf: true, sortOrder: 1, deletedAt: null },
  { id: 3, parentId: null, slug: "hair-care", name: { ar: "العناية بالشعر", en: "Hair Care" }, isLeaf: true, sortOrder: 2, deletedAt: null }
];

function makeOffer(id: number, nameEn: string, categoryId: number | null) {
  return {
    id,
    slug: `offer-${id}`,
    name: { ar: `عرض ${id}`, en: nameEn },
    description: { ar: "", en: "" },
    imagePath: "",
    media: [],
    price: 100,
    originalTotal: 150,
    categoryId,
    items: [],
    stock: 5,
    status: "active" as const,
    visibility: "visible" as const,
    createdAt: "",
    updatedAt: ""
  };
}

const dict = {
  common: { filters: "Filters" },
  filters: {
    sortBy: "Sort by",
    sortFeatured: "Featured",
    sortNewest: "Newest",
    sortPriceAsc: "Price low",
    sortPriceDesc: "Price high",
    sortName: "Name"
  },
  offers: { listEmpty: "No offers" }
};

afterEach(() => {
  cleanup();
});

describe("OfferGrid", () => {
  it("offers only root categories that own at least one offer as filter pills", () => {
    render(createElement(OfferGrid, {
      offers: [makeOffer(1, "Skin Offer", 2)],
      categories,
      lang: "en" as const,
      dict
    }));

    expect(screen.getByRole("button", { name: /Skin Care/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hair Care/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Creams/ })).not.toBeInTheDocument();
  });

  it("filters offers down to the selected root category tree", () => {
    render(createElement(OfferGrid, {
      offers: [makeOffer(1, "Skin Offer", 2), makeOffer(2, "Hair Offer", 3)],
      categories,
      lang: "en" as const,
      dict
    }));

    expect(screen.getAllByTestId("offer-card")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Skin Care/ }));

    const cards = screen.getAllByTestId("offer-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Skin Offer");
  });

  it("keeps an uncategorised legacy offer out of every category filter", () => {
    render(createElement(OfferGrid, {
      offers: [makeOffer(1, "Skin Offer", 2), makeOffer(2, "Legacy Offer", null)],
      categories,
      lang: "en" as const,
      dict
    }));

    expect(screen.getAllByTestId("offer-card")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /Skin Care/ }));

    const cards = screen.getAllByTestId("offer-card");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent("Skin Offer");
  });
});
