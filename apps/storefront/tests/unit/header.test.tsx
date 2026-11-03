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
  AnnouncementBar: ({ items }: { items: string[] }) => createElement("div", { "data-testid": "announcement-bar" }, items.join("|"))
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
    orders: "Orders",
    home: "Home",
    categories: "Categories"
  },
  langSwitch: {
    short: "AR"
  }
};

describe("Header layout stability", () => {
  it("points the logo link at the shop home instead of the locale root", () => {
    const { rerender } = render(<Header lang="en" dict={dict} menuEntries={[]} />);

    expect(screen.getByRole("link", { name: "Capella" })).toHaveAttribute("href", "/en/shop");

    rerender(<Header lang="ar" dict={dict} menuEntries={[]} />);

    expect(screen.getByRole("link", { name: "Capella" })).toHaveAttribute("href", "/ar/shop");
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

  it("has one big search bar on desktop, and no shop menu button", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} />);
    const bar = screen.getByTestId("desktop-search");
    expect(bar).toHaveTextContent("Search");
    expect(bar.className).toContain("w-full");
    expect(screen.queryByRole("button", { name: "Shop" })).toBeNull();
  });

  it("puts the logo first, then search, then the icons on desktop", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} />);
    const logo = screen.getByRole("link", { name: "Capella" });
    const bar = screen.getByTestId("desktop-search");
    const icons = screen.getByRole("button", { name: "Language" });
    expect(logo.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(icons) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links home and categories between the logo and the search bar on desktop", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} />);
    const logo = screen.getByRole("link", { name: "Capella" });
    const home = screen.getByRole("link", { name: "Home" });
    const categories = screen.getByRole("link", { name: "Categories" });
    const bar = screen.getByTestId("desktop-search");
    expect(home).toHaveAttribute("href", "/en/shop");
    expect(categories).toHaveAttribute("href", "/en/products");
    expect(logo.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(categories.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders CMS announcement texts when provided", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} announcements={["Free shipping", "New season"]} />);
    expect(screen.getByTestId("announcement-bar")).toHaveTextContent("Free shipping|New season");
  });

  it("hides the announcement bar when the CMS list is empty", () => {
    render(<Header lang="en" dict={dict} menuEntries={[]} announcements={[]} />);
    expect(screen.queryByTestId("announcement-bar")).not.toBeInTheDocument();
  });
});
