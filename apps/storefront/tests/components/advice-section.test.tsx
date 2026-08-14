import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/providers/cart-provider", async () => {
  const { cartKeyOf } = await import("../helpers/cart");
  return {
    useCart: () => ({
      add: vi.fn(),
      lines: [],
      count: 0,
      setQty: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      keyOf: cartKeyOf
    })
  };
});

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ has: () => false, toggle: vi.fn(), ids: [] })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: 1 } })
}));

import { AdviceSection } from "@/components/products/advice-section";

describe("AdviceSection", () => {
  it("renders active advice cards on the storefront products page", () => {
    render(createElement(AdviceSection, {
      lang: "en",
      dict: { advices: { title: "Capella Advices", description: "Helpful guidance" } },
      advices: [{
        id: 1,
        title: { ar: "نصيحة", en: "Advice" },
        description: { ar: "وصف", en: "Description" },
        videoUrl: "https://instagram.com/capella",
        status: "active",
        createdAt: "",
        updatedAt: ""
      }]
    }));

    expect(screen.getByText("Capella Advices")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Advice" })).toHaveAttribute("href", "https://instagram.com/capella");
    expect(screen.queryByRole("img", { name: "Advice" })).toBeNull();
  });

  it("lays advices out as the shop's scrolling row everywhere it is used", () => {
    const { container } = render(createElement(AdviceSection, {
      lang: "en",
      dict: { advices: { title: "Capella Advices", description: "Helpful guidance" } },
      advices: [{
        id: 1,
        title: { ar: "نصيحة", en: "Advice" },
        description: { ar: "وصف", en: "Description" },
        videoUrl: "https://www.youtube.com/watch?v=capella",
        status: "active" as const,
        createdAt: "",
        updatedAt: ""
      }]
    }));

    // ShopCardRow's signature: a snapping horizontal scroller with prev/next.
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(container.querySelector(".snap-x")).not.toBeNull();

    // and definitively not the old multi-row grid
    expect(container.querySelector(".lg\\:grid-cols-3")).toBeNull();
  });

  it("draws its scroll arrows in white, since advice cards are dark artwork", () => {
    render(createElement(AdviceSection, {
      lang: "en",
      dict: { advices: { title: "Capella Advices", description: "Helpful guidance" } },
      advices: [{
        id: 1,
        title: { ar: "نصيحة", en: "Advice" },
        description: { ar: "وصف", en: "Description" },
        videoUrl: "https://www.youtube.com/watch?v=capella",
        status: "active" as const,
        createdAt: "",
        updatedAt: ""
      }]
    }));

    expect(screen.getByRole("button", { name: "Previous" }).className).toContain("text-canvas");
    expect(screen.getByRole("button", { name: "Next" }).className).toContain("text-canvas");
  });
});
