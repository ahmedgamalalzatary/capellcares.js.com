import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() })
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ add: vi.fn(), lines: [], count: 0, setQty: vi.fn(), remove: vi.fn(), clear: vi.fn(), keyOf: vi.fn() })
}));

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
        sortOrder: 1,
        createdAt: "",
        updatedAt: ""
      }]
    }));

    expect(screen.getByText("Capella Advices")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Advice" })).toHaveAttribute("href", "https://instagram.com/capella");
    expect(screen.queryByRole("img", { name: "Advice" })).toBeNull();
  });
});
