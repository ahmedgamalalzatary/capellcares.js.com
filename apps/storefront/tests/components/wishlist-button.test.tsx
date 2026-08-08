import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

const has = vi.fn(() => false);
const toggle = vi.fn();
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

import { WishlistButton } from "@/components/ui/wishlist-button";

const props = { entityType: "product" as const, entityId: 1, lang: "en" as const, label: "Wishlist" };

describe("WishlistButton", () => {
  it("keeps the same background when saved — only the heart fills", () => {
    const { rerender } = render(createElement(WishlistButton, props));
    const idleClass = screen.getByRole("button", { name: "Wishlist" }).className;
    expect(screen.getByRole("button", { name: "Wishlist" }).querySelector("svg"))
      .toHaveAttribute("fill", "none");

    has.mockReturnValue(true);
    rerender(createElement(WishlistButton, props));

    const savedButton = screen.getByRole("button", { name: "Wishlist" });
    // Saved state is carried by the glyph alone: the plate never changes tone.
    expect(savedButton.className).toBe(idleClass);
    expect(savedButton.className).toContain("bg-surface/85");
    expect(savedButton.className).not.toContain("bg-accent");
    expect(savedButton.querySelector("svg")).toHaveAttribute("fill", "currentColor");
  });

  it("floats at the top-end corner of the media frame", () => {
    render(createElement(WishlistButton, props));

    const button = screen.getByRole("button", { name: "Wishlist" });
    expect(button.className).toContain("inset-e-2");
    expect(button.className).not.toContain("inset-s-2");
  });
});
