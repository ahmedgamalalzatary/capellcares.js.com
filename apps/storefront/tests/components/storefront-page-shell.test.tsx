import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/layout/breadcrumb", () => ({
  Breadcrumb: ({ items }: { items: Array<{ label: string }> }) => createElement("nav", null, items.map((item) => item.label).join(" / "))
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

    expect(screen.getByText("Home / Cart")).toBeInTheDocument();
    expect(screen.getByText("One step from checkout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cart" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });
});
