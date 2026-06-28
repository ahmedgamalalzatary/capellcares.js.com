import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

const push = vi.fn();
const has = vi.fn(() => false);
const toggle = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ add: vi.fn(), lines: [], count: 0, setQty: vi.fn(), remove: vi.fn(), clear: vi.fn(), keyOf: vi.fn() })
}));

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has, toggle })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

beforeEach(() => {
  vi.clearAllMocks();
  has.mockReturnValue(false);
});

import { SectionCard } from "@/components/shop/section-card";

const dict = {
  offers: { badge: "Bundle" },
  collections: { badge: "Set" },
  advices: { tipBadge: "Tip", readMore: "Read more", close: "Close" },
  common: { save: "Save", view: "View", addToCart: "Add to cart", added: "Added", cancel: "Cancel", addToWishlist: "Wishlist" }
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
  videoUrl: "https://www.youtube.com/watch?v=capella",
  status: "active" as const,
  sortOrder: 1,
  createdAt: "",
  updatedAt: ""
};

const instagramAdvice = {
  ...baseAdvice,
  videoUrl: "https://www.instagram.com/reel/DZfXbijzAD6/"
};

describe("SectionCard", () => {
  it("clears its add-to-cart timeout when unmounted", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = render(createElement(SectionCard, { kind: "offer", data: baseOffer, lang: "en", dict } as any));

    fireEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });

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

  it("adds an offer to wishlist from the card overlay", () => {
    render(createElement(SectionCard, { kind: "offer", data: baseOffer, lang: "en", dict } as any));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("offer", 1);
  });

  it("adds a collection to wishlist from the card overlay", () => {
    render(createElement(SectionCard, { kind: "collection", data: baseCollection, lang: "en", dict } as any));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("collection", 2);
  });

  it("does not render a struck-through original price when there are no savings", () => {
    const { container } = render(createElement(SectionCard, { kind: "collection", data: baseCollection, lang: "en", dict } as any));

    expect(container.querySelector(".line-through")).toBeNull();
  });

  it("uses full rounding for advice media while keeping top-only rounding for offers", () => {
    const { container, rerender } = render(
      createElement(SectionCard, { kind: "advice", data: baseAdvice, lang: "en", dict } as any)
    );

    const adviceMedia = container.querySelector(".aspect-8\\/9");
    expect(adviceMedia?.className).toContain("rounded-lg");
    expect(adviceMedia?.className).not.toContain("rounded-t-lg");

    rerender(createElement(SectionCard, { kind: "offer", data: baseOffer, lang: "en", dict } as any));

    const offerMedia = container.querySelector(".aspect-8\\/9");
    expect(offerMedia?.className).toContain("rounded-t-lg");
  });

  it("renders an advice as a video-only tile and opens a dialog with full content", () => {
    render(createElement(SectionCard, {
      kind: "advice",
      data: baseAdvice,
      lang: "en",
      dict
    } as any));

    expect(screen.queryByRole("heading", { name: "Tip One" })).toBeNull();
    expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tip One" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tip One" })).toBeInTheDocument();
    expect(screen.getByText("Advice description")).toBeInTheDocument();
    expect(screen.getByTitle("Tip One video")).toHaveAttribute("src", expect.stringContaining("autoplay=1"));
    expect(screen.getByRole("link", { name: /read more/i })).toHaveAttribute(
      "href",
      "https://www.instagram.com/capellacare?igsh=aDllZTVycjc4ZjJw&utm_source=qr"
    );
  });

  it("renders Instagram advice in the popup through the official embed markup instead of an iframe player", () => {
    render(createElement(SectionCard, {
      kind: "advice",
      data: instagramAdvice,
      lang: "en",
      dict
    } as any));

    fireEvent.click(screen.getByRole("button", { name: "Tip One" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByTitle("Tip One video")).toBeNull();
    const embed = document.querySelector("blockquote.instagram-media");
    expect(embed).not.toBeNull();
    expect(embed).toHaveAttribute("data-instgrm-permalink", "https://www.instagram.com/reel/DZfXbijzAD6/");
  });

  it("does not render an advice tile when the video URL is missing", () => {
    const { container } = render(
      createElement(SectionCard, { kind: "advice", data: { ...baseAdvice, videoUrl: "" }, lang: "en", dict } as any)
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not render any YouTube iframe before the advice modal opens", () => {
    render(createElement(SectionCard, {
      kind: "advice",
      data: baseAdvice,
      lang: "en",
      dict
    } as any));

    const trigger = screen.getByRole("button", { name: "Tip One" });
    expect(trigger.querySelector("iframe")).toBeNull();
    expect(screen.queryByTitle("Tip One video")).toBeNull();
  });

  it("renders unsupported advice URLs as external links instead of opening a dead modal", () => {
    render(createElement(SectionCard, {
      kind: "advice",
      data: { ...baseAdvice, videoUrl: "https://example.com/video.mp4" },
      lang: "en",
      dict
    } as any));

    const link = screen.getByRole("link", { name: "Tip One" });
    expect(link).toHaveAttribute("href", "https://example.com/video.mp4");
    expect(screen.queryByRole("button", { name: "Tip One" })).toBeNull();
    fireEvent.click(link);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves focus into the advice dialog, traps tab, closes on Escape, and restores focus", () => {
    render(createElement("div", null,
      createElement("button", { type: "button" }, "Before"),
      createElement(SectionCard, {
        kind: "advice",
        data: baseAdvice,
        lang: "en",
        dict
      } as any),
      createElement("button", { type: "button" }, "After")
    ));

    const trigger = screen.getByRole("button", { name: "Tip One" });
    trigger.focus();
    fireEvent.click(trigger);

    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toHaveFocus();
    const readMoreLink = screen.getByRole("link", { name: /read more/i });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });
    expect(readMoreLink).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
