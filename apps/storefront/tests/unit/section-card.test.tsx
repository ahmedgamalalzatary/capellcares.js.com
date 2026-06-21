import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ add: vi.fn(), lines: [], count: 0, setQty: vi.fn(), remove: vi.fn(), clear: vi.fn(), keyOf: vi.fn() })
}));

import { SectionCard } from "@/components/shop/section-card";

const dict = {
  offers: { badge: "Bundle" },
  collections: { badge: "Set" },
  advices: { tipBadge: "Tip", readMore: "Read more" },
  common: { save: "Save", view: "View", addToCart: "Add to cart" }
};

const baseOffer = {
  id: 1,
  slug: "rose",
  name: { ar: "وردة", en: "Rose Bundle" },
  description: { ar: "وصف", en: "Rose description" },
  imagePath: "",
  price: 50,
  originalTotal: 80,
  items: [],
  stock: 5,
  status: "active" as const,
  createdAt: "",
  updatedAt: ""
};

const baseCollection = {
  id: 2,
  slug: "glow",
  name: { ar: "توهج", en: "Glow Set" },
  description: { ar: "وصف", en: "Glow description" },
  imagePath: "",
  price: 40,
  originalTotal: 40,
  categoryId: 1,
  items: [],
  stock: 5,
  status: "active" as const,
  visibility: "visible" as const,
  createdAt: "",
  updatedAt: ""
};

const baseAdvice = {
  id: 3,
  title: { ar: "نصيحة", en: "Tip One" },
  description: { ar: "وصف", en: "Advice description" },
  imagePath: null,
  videoUrl: null as string | null,
  status: "active" as const,
  sortOrder: 1,
  createdAt: "",
  updatedAt: ""
};

describe("SectionCard", () => {
  it("renders an offer with title, savings, and links to the offer detail page", () => {
    const { container } = render(createElement(SectionCard, { kind: "offer", data: baseOffer, lang: "en", dict } as any));

    expect(screen.getByRole("heading", { name: "Rose Bundle" })).toBeInTheDocument();
    expect(screen.getByText("★ Bundle")).toBeInTheDocument(); // badge

    // Savings are shown as the struck-through original total (80) beside the price (50).
    const struckOriginal = container.querySelector(".line-through");
    expect(struckOriginal).not.toBeNull();
    expect(struckOriginal).toHaveTextContent(/80/); // original total (formatPrice 80) shown struck-through

    // The card links to the detail page from the image, the heading, and the View button.
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/en/offers/rose"));
  });

  it("renders a collection linking to the collection detail page", () => {
    render(createElement(SectionCard, { kind: "collection", data: baseCollection, lang: "en", dict } as any));

    expect(screen.getByRole("heading", { name: "Glow Set" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/en/collections/glow"));
  });

  it("does not render a struck-through original price when there are no savings", () => {
    const { container } = render(createElement(SectionCard, { kind: "collection", data: baseCollection, lang: "en", dict } as any));

    expect(container.querySelector(".line-through")).toBeNull();
  });

  it("renders an advice with its title and a video link when videoUrl exists, without a price", () => {
    render(createElement(SectionCard, {
      kind: "advice",
      data: { ...baseAdvice, videoUrl: "https://video.example/clip" },
      lang: "en",
      dict
    } as any));

    expect(screen.getByRole("heading", { name: "Tip One" })).toBeInTheDocument();
    expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://video.example/clip");
  });

  it("renders an advice without a video link or image when neither exists", () => {
    render(createElement(SectionCard, { kind: "advice", data: baseAdvice, lang: "en", dict } as any));

    expect(screen.getByRole("heading", { name: "Tip One" })).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
