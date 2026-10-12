import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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

const authState: { user: { id: number } | null } = { user: { id: 1 } };
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => authState
}));

beforeEach(() => {
  vi.clearAllMocks();
  has.mockReturnValue(false);
  authState.user = { id: 1 };
});

import { WishlistButton } from "@/components/ui/wishlist-button";

const props = { entityType: "product" as const, entityId: 1, lang: "en" as const, label: "Wishlist" };

describe("WishlistButton", () => {
  it("adds the entity when the heart is pressed on an unsaved item", () => {
    render(createElement(WishlistButton, props));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("product", 1);
    expect(push).not.toHaveBeenCalled();
  });

  it("removes the entity when the heart is pressed on a saved item", () => {
    has.mockReturnValue(true);
    render(createElement(WishlistButton, props));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("product", 1);
    expect(push).not.toHaveBeenCalled();
  });

  it("toggles the requested entity type and id, not a fixed one", () => {
    render(createElement(WishlistButton, { ...props, entityType: "offer", entityId: 7, lang: "ar" }));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(toggle).toHaveBeenCalledWith("offer", 7);
    expect(has).toHaveBeenCalledWith("offer", 7);
  });

  it("sends a signed-out shopper to the wishlist page instead of toggling", () => {
    authState.user = null;
    render(createElement(WishlistButton, props));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(push).toHaveBeenCalledWith("/en/wishlist");
    expect(toggle).not.toHaveBeenCalled();
  });

  it("localizes the signed-out destination for an Arabic page", () => {
    authState.user = null;
    render(createElement(WishlistButton, { ...props, lang: "ar" }));

    fireEvent.click(screen.getByRole("button", { name: "Wishlist" }));

    expect(push).toHaveBeenCalledWith("/ar/wishlist");
  });

  it("uses the accessible label it is given rather than the icon", () => {
    render(createElement(WishlistButton, { ...props, label: "أضف إلى المفضلة" }));

    expect(screen.getByRole("button", { name: "أضف إلى المفضلة" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wishlist" })).toBeNull();
  });
});