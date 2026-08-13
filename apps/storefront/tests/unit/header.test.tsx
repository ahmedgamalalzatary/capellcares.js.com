import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/en/products";
let searchParams = new URLSearchParams("sort=new");

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

vi.mock("@/components/providers/cart-provider", () => ({
  useCart: () => ({ count: 2 })
}));

vi.mock("@/components/providers/wishlist-provider", () => ({
  useWishlist: () => ({ ids: [11] })
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ user: null })
}));

vi.mock("@/components/layout/header/mobile-drawer", () => ({
  HeaderMobileDrawer: () => null
}));

vi.mock("@/components/layout/header/announcement-bar", () => ({
  AnnouncementBar: () => null
}));

vi.mock("@/components/layout/header/shop-mega-menu", () => ({
  ShopMegaMenu: () => null
}));

vi.mock("@/components/layout/header/search-overlay", () => ({
  SearchOverlay: () => null
}));

vi.mock("@/hooks/use-language-switch", () => ({
  useLanguageSwitch: () => ({ switchLang: vi.fn() })
}));

import { Header } from "@/components/layout/header";

beforeEach(() => {
  pathname = "/en/products";
  searchParams = new URLSearchParams("sort=new");
});

const dict = {
  brand: "Capella",
  nav: {
    announcement: "Notice",
    announcements: ["Notice"],
    pause: "Pause",
    play: "Play",
    search: "Search",
    wishlist: "Wishlist",
    cart: "Cart",
    account: "Account",
    orders: "Orders"
  },
  langSwitch: {
    short: "AR"
  }
};

describe("Header layout stability", () => {
  it("keeps the logo link scaling class on the link container", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} />);

    const logoLink = screen.getByRole("link", { name: "Capella" });
    expect(logoLink.className).toContain("scale-130");
  });

  it("keeps the mobile menu button scaling class on the button", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} />);

    const menuButton = screen.getByRole("button", { name: "Menu" });
    expect(menuButton.className).toContain("scale-130");
  });

  it("keeps account redirects current across query-only navigation", () => {
    const { rerender } = render(<Header lang="en" dict={dict} menuEntries={[]} />);

    expect(screen.getAllByRole("link", { name: "Account" })[0]).toHaveAttribute(
      "href",
      "/en/login?next=%2Fen%2Fproducts%3Fsort%3Dnew"
    );

    searchParams = new URLSearchParams("sort=price-desc");
    rerender(<Header lang="en" dict={dict} menuEntries={[]} />);

    expect(screen.getAllByRole("link", { name: "Account" })[0]).toHaveAttribute(
      "href",
      "/en/login?next=%2Fen%2Fproducts%3Fsort%3Dprice-desc"
    );
  });
});
