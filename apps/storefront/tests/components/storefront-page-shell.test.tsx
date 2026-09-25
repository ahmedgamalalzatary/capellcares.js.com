import { createElement } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => createElement("a", { href, ...rest }, children)
}));

import { StorefrontPageShell } from "@/components/layout/storefront-page-shell";

describe("StorefrontPageShell", () => {
  it("renders shared breadcrumb and header chrome", () => {
    render(createElement(StorefrontPageShell, {
      breadcrumbItems: [
        { label: "Home", href: "/en" },
        { label: "Cart" }
      ],
      eyebrow: "One step from checkout",
      title: "Cart",
      children: createElement("div", null, "content")
    }));

    expect(screen.getByText("One step from checkout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cart" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("keeps the current page crumb visible as plain text instead of dropping it", () => {
    render(createElement(StorefrontPageShell, {
      breadcrumbItems: [
        { label: "Home", href: "/en" },
        { label: "Cart" }
      ],
      eyebrow: "One step from checkout",
      title: "Cart",
      children: createElement("div", null, "content")
    }));

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });

    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/en");
    expect(within(nav).getByText("Cart")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Cart" })).toBeNull();
    expect(within(nav).getByText("Cart").className).toContain("text-ink");
  });

  it("keeps an intermediate crumb without a link visible", () => {
    render(createElement(StorefrontPageShell, {
      breadcrumbItems: [
        { label: "Home", href: "/en" },
        { label: "Orders" },
        { label: "1024", href: "/en/orders/1024" }
      ],
      eyebrow: "Order",
      title: "Order 1024",
      children: createElement("div", null, "content")
    }));

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });

    expect(within(nav).getByText("Orders")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Orders" })).toBeNull();
    expect(within(nav).getByText("1024")).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "1024" })).toBeNull();
  });
});
